package com.university.platform.execution.service;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.VisibilityMode;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.assessment.repository.TPFinalSubmissionRepository;
import com.university.platform.execution.service.DockerService.TestCaseResult;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;

import com.university.platform.config.RabbitMQConfig;
import com.university.platform.execution.model.SubmissionJobMessage;
import com.university.platform.execution.dto.SubmissionRequestDTO;
import com.university.platform.execution.dto.SubmissionResponseDTO;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.Problem;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import com.university.platform.identity.model.Student;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository  submissionRepository;
    private final StudentRepository     studentRepository;
    private final ProblemRepository     problemRepository;
    private final AssessmentRepository  assessmentRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final TPFinalSubmissionRepository tpFinalSubmissionRepository;
    private final RabbitTemplate        rabbitTemplate;
    private final com.university.platform.config.RateLimitConfig rateLimitConfig;

    @Transactional
    public SubmissionResponseDTO submit(SubmissionRequestDTO request) {

        Student student = studentRepository.findById(request.getStudentId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Student not found: " + request.getStudentId()));

        Problem problem = problemRepository.findById(request.getProblemId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Problem not found: " + request.getProblemId()));

        // Per-(user, event) flood control at intake — never throttles the judge worker.
        UUID eventId = request.getAssessmentId() != null ? request.getAssessmentId() : problem.getProblemId();
        if (!rateLimitConfig.resolveSubmissionBucket(student.getId() + ":" + eventId).tryConsume(1)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many submissions — please slow down and try again shortly.");
        }

        Assessment assessment = null;
        if (request.getAssessmentId() != null) {
            assessment = assessmentRepository.findById(request.getAssessmentId())
                    .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + request.getAssessmentId()));

            validateStudentAccess(assessment, student.getId(), request.getAccessCode());
        }

        int attemptNumber = 1;
        if (!request.isRunOnly()) {
            if (assessment != null) {
                attemptNumber = 1 + (int) submissionRepository
                        .countAttempts(student.getId(), problem.getProblemId(), assessment.getAssessmentId());
                // Enforce per-task attempt cap on TPs (null = unlimited).
                if (assessment instanceof OpenTP openTP
                        && openTP.getMaxAttemptsAllowed() != null
                        && attemptNumber > openTP.getMaxAttemptsAllowed()) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "You have reached the maximum number of attempts for this task.");
                }
            } else {
                attemptNumber = 1 + (int) submissionRepository
                        .countByStudent_IdAndProblem_ProblemIdAndAssessmentIsNullAndPlanningModeFalse(
                                student.getId(), problem.getProblemId());
            }
        }

        Submission submission = Submission.builder()
                .sourceCode(request.getSourceCode())
                .language(request.getLanguage())
                .timestamp(LocalDateTime.now())
                .attemptNumber(attemptNumber)
                .status(SubmissionStatus.PENDING)
                .student(student)
                .problem(problem)
                .assessment(assessment)
                .planningMode(request.isRunOnly())
                .build();



        submission = submissionRepository.save(submission);
        log.info("[SUBMISSION] Saved PENDING submission {} for student {} / problem {}",
                submission.getSubmissionId(), student.getId(), problem.getProblemId());

        SubmissionJobMessage message = SubmissionJobMessage.builder()
                .submissionId(submission.getSubmissionId())
                .problemId(problem.getProblemId())
                .studentId(student.getId())
                .sourceCode(request.getSourceCode())
                .language(request.getLanguage())
                .timeLimitMs(problem.getTimeLimitMs())
                .memoryLimitMb(problem.getMemoryLimitMb())
                .runOnly(request.isRunOnly())
                .build();

        // Publish only after this transaction commits. RabbitMQ can deliver to
        // the worker faster than Postgres commits the row on another
        // connection — the worker's findById(submissionId) would then race
        // ahead of the commit and silently drop the job ("not found in DB"),
        // leaving the submission stuck PENDING forever with no result. This
        // was intermittent under a cold JVM/connection pool and became
        // consistent once warm, hence "takes a long time then returns WA" —
        // the frontend's 30s timeout was firing because the message was
        // never actually processed at all.
        UUID submissionId = submission.getSubmissionId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    rabbitTemplate.convertAndSend(
                            RabbitMQConfig.EXCHANGE_NAME,
                            RabbitMQConfig.ROUTING_KEY,
                            message
                    );
                    log.info("[SUBMISSION] Published job {} to queue '{}' (after commit)",
                            submissionId, RabbitMQConfig.QUEUE_NAME);
                }
            });
        } else {
            // No active transaction (shouldn't happen — this method is @Transactional) —
            // publish immediately rather than silently dropping the job.
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, message);
            log.info("[SUBMISSION] Published job {} to queue '{}' (no active tx)", submissionId, RabbitMQConfig.QUEUE_NAME);
        }

        return new SubmissionResponseDTO(
                submission.getSubmissionId(),
                SubmissionStatus.PENDING.name(),
                "Your submission is queued. Connect to /topic/submissions/"
                        + submission.getSubmissionId() + " for real-time results."
        );
    }

    private void validateStudentAccess(Assessment assessment, UUID studentId, String providedCode) {
        VisibilityMode mode = assessment.getVisibilityMode();

        if (!Boolean.TRUE.equals(assessment.getIsPublished())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This assessment has not been published yet.");
        }

        if (assessment instanceof LiveExam liveExam) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime start = liveExam.getScheduledStartTime();
            LocalDateTime end = start.plusMinutes(liveExam.getDurationMinutes());
            if (now.isBefore(start) || now.isAfter(end)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "LiveExam is not active.");
            }
        }

        if (assessment instanceof OpenTP openTP) {
            if (openTP.getDeadline() != null && LocalDateTime.now().isAfter(openTP.getDeadline())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "The deadline for this TP has passed.");
            }
            // Once the student clicks "Submit TP" their work is locked.
            if (tpFinalSubmissionRepository.existsByAssessmentIdAndStudentId(
                    assessment.getAssessmentId(), studentId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You have already submitted this TP — no further changes are allowed.");
            }
        }

        switch (mode) {
            case MODULE_ONLY -> {
                // Module filtering is enforced at the discovery level; no additional check at submission.
            }
            case ACCESS_CODE -> {
                if (assessment instanceof LiveExam liveExam) {
                    String expected = liveExam.getStrictAccessCode();
                    if (expected != null && !expected.isBlank() && !expected.equals(providedCode)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid access code.");
                    }
                } else if (assessment instanceof OpenTP openTP) {
                    String expected = openTP.getStrictAccessCode();
                    // A blank/unset code (TPs created before this column existed never
                    // had one) means nothing was ever configured — don't hard-lock the
                    // TP with an unsatisfiable check; only enforce when a real code is set.
                    if (expected != null && !expected.isBlank() && !expected.equals(providedCode)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid access code.");
                    }
                }
            }
            case REQUEST_BASED -> {
                JoinRequest jr = joinRequestRepository
                        .findByAssessmentIdAndStudentId(assessment.getAssessmentId(), studentId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                "You do not have an approved request to participate in this assessment."));
                if (jr.getStatus() != JoinRequestStatus.APPROVED) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Your participation request has not been approved yet.");
                }
            }
        }
    }

}
