package com.university.platform.assessment.controller;

import com.university.platform.assessment.dto.ExamResultsDTO;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.model.ExamAttemptResult;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.repository.AssessmentProblemRepository;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.ExamAttemptResultRepository;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Post-exam results endpoint. Kept separate from {@link AssessmentController}
 * so the (heavier) results aggregation stays off the hot exam-room path.
 */
@RestController
@RequestMapping("/api/assessments")
@RequiredArgsConstructor
public class ExamResultsController {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentProblemRepository assessmentProblemRepository;
    private final ExamAttemptResultRepository examAttemptResultRepository;
    private final SubmissionRepository submissionRepository;
    private final JwtService jwtService;

    private static final String[] LABELS = {"A","B","C","D","E","F","G","H","I","J"};

    @GetMapping("/{assessmentId}/exam-results")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getExamResults(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        io.jsonwebtoken.Claims claims = jwtService.parseToken(token);
        UUID studentId = UUID.fromString(claims.getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId).orElse(null);
        if (!(assessment instanceof LiveExam exam)) {
            return ResponseEntity.notFound().build();
        }
        if (!Boolean.TRUE.equals(exam.getGradesRevealed())) {
            return ResponseEntity.status(403)
                    .body("{\"error\": \"Results have not been released for this exam yet.\"}");
        }

        List<AssessmentProblem> aps = assessmentProblemRepository
                .findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId);

        // Best-score-per-problem rows for this student.
        Map<UUID, ExamAttemptResult> attemptByProblem = new HashMap<>();
        for (ExamAttemptResult r : examAttemptResultRepository
                .findByAssessmentIdAndStudentId(assessmentId, studentId)) {
            attemptByProblem.put(r.getProblemId(), r);
        }

        // Latest submitted code per problem (newest first — keep the first seen).
        Map<UUID, Submission> latestByProblem = new HashMap<>();
        for (Submission s : submissionRepository
                .findByAssessment_AssessmentIdAndStudent_IdOrderByTimestampDesc(assessmentId, studentId)) {
            latestByProblem.putIfAbsent(s.getProblem().getProblemId(), s);
        }

        int finalScore = 0, totalPoints = 0, submittedCount = 0, acceptedCount = 0;
        List<ExamResultsDTO.ProblemResultDTO> results = new ArrayList<>();

        for (int i = 0; i < aps.size(); i++) {
            AssessmentProblem ap = aps.get(i);
            var problem = ap.getProblem();
            UUID pid = problem.getProblemId();
            String label = i < LABELS.length ? LABELS[i] : String.valueOf(i + 1);
            int maxPoints = ap.effectiveMaxPoints();

            ExamAttemptResult ar = attemptByProblem.get(pid);
            // earnedScore already reflects this exam's configured scoring mode
            // (LAST_SUBMISSION vs BEST_SUBMISSION) — bestScore alone would
            // silently ignore LAST_SUBMISSION and always show the best attempt.
            int earned = ar != null ? Math.min(ar.getEarnedScore(), maxPoints) : 0;
            int passedCases = ar != null ? ar.getBestPassed() : 0;
            int totalCases = ar != null ? ar.getBestTotal() : 0;
            int attempts = ar != null ? ar.getAttempts() : 0;

            String verdict;
            if (attempts == 0) {
                verdict = "NS";
            } else if (totalCases > 0 && passedCases >= totalCases) {
                verdict = "AC";
            } else if (passedCases > 0 || earned > 0) {
                verdict = "PARTIAL";
            } else {
                verdict = "WA";
            }

            if (attempts > 0) submittedCount++;
            if ("AC".equals(verdict)) acceptedCount++;
            finalScore += earned;
            totalPoints += maxPoints;

            Submission sub = latestByProblem.get(pid);
            results.add(new ExamResultsDTO.ProblemResultDTO(
                    pid, label, problem.getTitle(),
                    earned, maxPoints, passedCases, totalCases, verdict,
                    sub != null ? sub.getSourceCode() : null,
                    sub != null && sub.getLanguage() != null ? sub.getLanguage().name() : null
            ));
        }

        int gradePercent = totalPoints > 0 ? Math.round(100f * finalScore / totalPoints) : 0;
        int passingScore = exam.getPassingScore() != null ? exam.getPassingScore() : 50;

        return ResponseEntity.ok(new ExamResultsDTO(
                assessmentId, exam.getTitle(),
                finalScore, totalPoints, gradePercent, passingScore,
                gradePercent >= passingScore,
                submittedCount, acceptedCount, aps.size(), results));
    }
}
