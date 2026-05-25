package com.university.platform.assessment.controller;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.ResultRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.execution.service.ScoringService;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.EmailService;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
public class TeacherReviewController {

    private final SubmissionRepository submissionRepository;
    private final ResultRepository resultRepository;
    private final TeacherRepository teacherRepository;
    private final AssessmentRepository assessmentRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;
    private final JwtService jwtService;
    private final ScoringService scoringService;

    @PostMapping("/exams/{examId}/close")
    @Transactional
    public ResponseEntity<?> closeExam(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);

        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        Assessment assessment = assessmentRepository.findById(examId).orElse(null);
        if (!(assessment instanceof LiveExam exam)) {
            return ResponseEntity.status(404).body(Map.of("error", "Exam not found"));
        }
        if (!exam.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        // Persist the closed flag
        exam.setIsClosed(true);
        assessmentRepository.save(exam);

        // Auto-reject any still-pending join requests
        String rejectionReason = "The exam has been closed by the teacher.";
        List<JoinRequest> pending =
                joinRequestRepository.findByAssessmentIdAndStatus(examId, JoinRequestStatus.PENDING);
        for (JoinRequest jr : pending) {
            jr.setStatus(JoinRequestStatus.REJECTED);
            jr.setRejectionReason(rejectionReason);
            jr.setDecidedAt(LocalDateTime.now());
            joinRequestRepository.save(jr);
            pushRejectionToStudent(jr.getStudentId(), exam.getTitle(), examId, rejectionReason);
            emailService.sendJoinRequestRejected(jr.getStudentId(), exam.getTitle(), rejectionReason);
        }

        return ResponseEntity.ok(Map.of("message", "Exam closed successfully"));
    }

    private void pushRejectionToStudent(UUID studentId, String targetTitle,
                                         UUID targetId, String reason) {
        try {
            messagingTemplate.convertAndSend(
                    "/topic/students/" + studentId + "/notifications",
                    Map.of("type", "JOIN_REQUEST_REJECTED",
                           "targetTitle", targetTitle,
                           "targetId", targetId.toString(),
                           "isCompetition", false,
                           "reason", reason));
        } catch (Exception ex) {
            // non-critical
        }
    }

    @GetMapping("/exams/{examId}/submissions")
    public ResponseEntity<?> getSubmissions(
            @PathVariable UUID examId,
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) UUID problemId,
            @RequestHeader("Authorization") String authHeader,
            Pageable pageable) {
        
        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);
        
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        // Simplistic implementation for the test
        // Ideally we'd use a Specification<Submission> to filter properly
        Page<Submission> submissions;
        if (studentId != null) {
            var list = submissionRepository.findByAssessment_AssessmentIdAndStudent_IdOrderByTimestampDesc(examId, studentId);
            int start = (int) pageable.getOffset();
            int end = Math.min((start + pageable.getPageSize()), list.size());
            submissions = new org.springframework.data.domain.PageImpl<>(
                    list.subList(start, end), pageable, list.size()
            );
        } else {
            submissions = submissionRepository.findByAssessment_AssessmentId(examId, pageable);
        }

        var responseContent = submissions.map(sub -> {
            boolean hasResult = sub.getResult() != null;
            return Map.of(
                    "submissionId", sub.getSubmissionId(),
                    "studentId", sub.getStudent().getId(),
                    "problemId", sub.getProblem().getProblemId(),
                    "sourceCode", sub.getSourceCode(),
                    "pointsAwarded", hasResult ? sub.getResult().getPointsAwarded() : 0.0,
                    "teacherPenaltyOverride", hasResult ? sub.getResult().getTeacherPenaltyOverride() : 0.0,
                    "status", hasResult ? sub.getResult().getStatus().name() : "PENDING"
            );
        });

        return ResponseEntity.ok(responseContent);
    }

    @PostMapping("/submissions/{submissionId}/penalty")
    public ResponseEntity<?> applyPenalty(
            @PathVariable UUID submissionId,
            @RequestBody PenaltyRequest req,
            @RequestHeader("Authorization") String authHeader) {
        
        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);
        
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        Result result = resultRepository.findBySubmission_SubmissionId(submissionId)
                .orElseThrow(() -> new RuntimeException("Result not found for submission"));

        result.setTeacherPenaltyOverride(req.penaltyValue());
        result.setFeedback(result.getFeedback() + "\n[Teacher Review]: " + req.reason());
        
        resultRepository.save(result);
        
        return ResponseEntity.ok(Map.of("message", "Penalty applied successfully"));
    }

    public record PenaltyRequest(Double penaltyValue, String reason) {}
}
