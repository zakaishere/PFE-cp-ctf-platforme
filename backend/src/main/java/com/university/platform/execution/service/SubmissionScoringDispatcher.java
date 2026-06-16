package com.university.platform.execution.service;

import com.university.platform.assessment.service.ExamScoringService;
import com.university.platform.competition.service.CompetitionScoringService;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scores a submission <strong>exactly once</strong>, in a single transaction.
 *
 * <p>An atomic claim ({@code markScoredIfUnscored}) flips the submission's
 * {@code scored} flag false→true and gates all scoring: a redelivered or
 * concurrently-processed RabbitMQ message claims 0 rows and becomes a no-op.
 * Competition and exam scoring run with default propagation, so they join this
 * transaction and commit atomically with the claim — if scoring fails the claim
 * is rolled back and the work can be retried.
 *
 * <p>This replaces the previous per-service {@code REQUIRES_NEW} dispatch, which
 * had no idempotency guard and re-scored on redelivery.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubmissionScoringDispatcher {

    private final SubmissionRepository submissionRepository;
    private final CompetitionScoringService competitionScoringService;
    private final ExamScoringService examScoringService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void scoreOnce(Submission submission, Result result, int passedCount, int totalCount) {
        if (submission.isPlanningMode()) return;   // run-only never scores

        int claimed = submissionRepository.markScoredIfUnscored(submission.getSubmissionId());
        if (claimed == 0) {
            log.info("[SCORING] submission {} already scored — skipping (idempotent)",
                    submission.getSubmissionId());
            return;
        }

        if (submission.getCompetitionId() != null) {
            competitionScoringService.processResult(submission, result, passedCount, totalCount);
        }

        if (submission.getAssessment() != null) {
            examScoringService.scoreSubmission(
                    submission.getAssessment().getAssessmentId(),
                    submission.getProblem().getProblemId(),
                    submission.getStudent().getId(),
                    passedCount, totalCount);
        }
    }
}
