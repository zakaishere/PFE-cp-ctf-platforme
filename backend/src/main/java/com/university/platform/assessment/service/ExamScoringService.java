package com.university.platform.assessment.service;

import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.model.ExamAttemptResult;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentProblemRepository;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.ExamAttemptResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Assessment (Exam / TP) scoring — distinct from competition scoring.
 *
 *   - Partial credit: score = round(passed/total × maxPoints).
 *   - Best submission per (assessment, problem, student) is kept.
 *   - Time is irrelevant: no decay, no penalty, no bonus.
 *   - TP: best score is pushed live to the student over WebSocket.
 *   - Exam: stored silently; revealed only when the exam closes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamScoringService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentProblemRepository assessmentProblemRepository;
    private final ExamAttemptResultRepository examAttemptResultRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void scoreSubmission(UUID assessmentId, UUID problemId, UUID studentId,
                                int passedCount, int totalCount) {
        Assessment assessment = assessmentRepository.findById(assessmentId).orElse(null);
        if (assessment == null) {
            log.warn("[EXAM-SCORING] Assessment {} not found", assessmentId);
            return;
        }

        int maxPoints = assessmentProblemRepository
                .findByAssessment_AssessmentIdAndProblem_ProblemId(assessmentId, problemId)
                .map(AssessmentProblem::effectiveMaxPoints)
                .orElse(25);

        int newScore = totalCount > 0
                ? (int) Math.round(((double) passedCount / totalCount) * maxPoints)
                : 0;

        ExamAttemptResult res = examAttemptResultRepository
                .findByAssessmentIdAndProblemIdAndStudentId(assessmentId, problemId, studentId)
                .orElseGet(() -> ExamAttemptResult.create(assessmentId, problemId, studentId));

        boolean improved = newScore > res.getBestScore();
        if (improved) {
            res.setBestScore(newScore);
            res.setBestPassed(passedCount);
            res.setBestTotal(totalCount);
        }
        res.setAttempts(res.getAttempts() + 1);
        res.setUpdatedAt(LocalDateTime.now());
        examAttemptResultRepository.save(res);

        log.info("[EXAM-SCORING] assessment={} problem={} student={} score={}/{} (best={})",
                assessmentId, problemId, studentId, newScore, maxPoints, res.getBestScore());

        // TP: live score push. Exam: stay silent until close.
        if (assessment instanceof OpenTP) {
            try {
                messagingTemplate.convertAndSendToUser(
                        studentId.toString(),
                        "/queue/tp/score",
                        Map.of(
                                "assessmentId", assessmentId.toString(),
                                "problemId", problemId.toString(),
                                "score", res.getBestScore(),
                                "maxScore", maxPoints,
                                "passed", passedCount,
                                "total", totalCount
                        )
                );
            } catch (Exception ex) {
                log.warn("[EXAM-SCORING] TP live push failed: {}", ex.getMessage());
            }
        }
    }

    /**
     * Total score + percentage grade for a student across all assessment
     * problems, summing the best score per problem. No time factor.
     */
    @Transactional(readOnly = true)
    public ExamGrade computeGrade(UUID assessmentId, UUID studentId) {
        List<AssessmentProblem> problems =
                assessmentProblemRepository.findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId);
        int totalMax = problems.stream().mapToInt(AssessmentProblem::effectiveMaxPoints).sum();

        Map<UUID, ExamAttemptResult> byProblem = examAttemptResultRepository
                .findByAssessmentIdAndStudentId(assessmentId, studentId).stream()
                .collect(java.util.stream.Collectors.toMap(ExamAttemptResult::getProblemId, r -> r, (a, b) -> a));

        int earned = problems.stream()
                .map(ap -> byProblem.get(ap.getProblem().getProblemId()))
                .filter(java.util.Objects::nonNull)
                .mapToInt(ExamAttemptResult::getBestScore)
                .sum();

        double percentage = totalMax > 0 ? (earned * 100.0) / totalMax : 0.0;
        return new ExamGrade(earned, totalMax, Math.round(percentage * 100.0) / 100.0);
    }

    public record ExamGrade(int earned, int totalMax, double percentage) {}
}
