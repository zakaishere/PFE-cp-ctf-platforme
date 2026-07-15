package com.university.platform.assessment.service;

import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.model.ExamAttemptResult;
import com.university.platform.assessment.model.LiveExam;
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

    // Joins the caller's single scoring transaction; the per-student result row
    // is locked FOR UPDATE so concurrent submissions can't lose the attempts
    // increment or the best-score update.
    @Transactional
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

        // Race-free upsert + locked read so concurrent submissions for the same
        // (assessment, problem, student) serialise their best-score / attempts writes.
        examAttemptResultRepository.insertIfAbsent(assessmentId, problemId, studentId);
        ExamAttemptResult res = examAttemptResultRepository
                .findForUpdate(assessmentId, problemId, studentId)
                .orElseThrow(() -> new IllegalStateException(
                        "exam-attempt row missing after upsert for student " + studentId));

        boolean fullyPassed = totalCount > 0 && passedCount == totalCount;
        if (!res.isSolved() && !fullyPassed) {
            res.setFailedAttempts(res.getFailedAttempts() + 1);
        }
        if (fullyPassed) {
            res.setSolved(true);
        }

        boolean improved = newScore > res.getBestScore();
        if (improved) {
            res.setBestScore(newScore);
            res.setBestPassed(passedCount);
            res.setBestTotal(totalCount);
        }
        res.setLastScore(newScore);
        res.setLastPassed(passedCount);
        res.setLastTotal(totalCount);
        res.setAttempts(res.getAttempts() + 1);
        res.setUpdatedAt(LocalDateTime.now());

        int earnedScore = computeEarnedScore(assessment, res, maxPoints);
        res.setEarnedScore(earnedScore);

        examAttemptResultRepository.save(res);

        log.info("[EXAM-SCORING] assessment={} problem={} student={} score={}/{} (best={}, earned={})",
                assessmentId, problemId, studentId, newScore, maxPoints, res.getBestScore(), earnedScore);

        // TP: live score push. Exam: stay silent until close.
        if (assessment instanceof OpenTP) {
            try {
                messagingTemplate.convertAndSendToUser(
                        studentId.toString(),
                        "/queue/tp/score",
                        Map.of(
                                "assessmentId", assessmentId.toString(),
                                "problemId", problemId.toString(),
                                "score", earnedScore,
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
     * Applies the assessment's configured scoring mode (and TP attempt-penalty,
     * if enabled) to derive the final awarded score for one (assessment,
     * problem, student). {@code res}'s best/last/solved/failedAttempts fields
     * must already reflect the current attempt before calling this.
     */
    private int computeEarnedScore(Assessment assessment, ExamAttemptResult res, int maxPoints) {
        if (assessment instanceof OpenTP tp) {
            if ("ATTEMPT_PENALTY".equals(tp.getScoringMode())) {
                int penaltyPercent = tp.getPenaltyPercent() != null ? tp.getPenaltyPercent() : 0;
                int deductionPct = res.getFailedAttempts() * penaltyPercent;
                if (res.isSolved()) {
                    int effectivePct = Math.max(0, 100 - deductionPct);
                    return (int) Math.round(effectivePct / 100.0 * maxPoints);
                }
                // Not solved yet — best raw score so far, reduced by the same penalty.
                int deductionPoints = (int) Math.round(deductionPct / 100.0 * maxPoints);
                return Math.max(0, res.getBestScore() - deductionPoints);
            }
            // BEST_SUBMISSION / NO_PENALTY (alias) — unchanged current behavior.
            return res.getBestScore();
        }
        // LiveExam
        boolean lastSubmission = assessment instanceof LiveExam exam
                && "LAST_SUBMISSION".equals(exam.getScoringMode());
        return lastSubmission ? res.getLastScore() : res.getBestScore();
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
                .mapToInt(ExamAttemptResult::getEarnedScore)
                .sum();

        double percentage = totalMax > 0 ? (earned * 100.0) / totalMax : 0.0;
        return new ExamGrade(earned, totalMax, Math.round(percentage * 100.0) / 100.0);
    }

    public record ExamGrade(int earned, int totalMax, double percentage) {}
}
