package com.university.platform.execution.service;

import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.service.ExamScoringService;
import com.university.platform.audit.AuditDomain;
import com.university.platform.audit.AuditEventService;
import com.university.platform.audit.Severity;
import com.university.platform.competition.service.CompetitionScoringService;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

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
    private final AuditEventService auditEventService;
    private final AssessmentRepository assessmentRepository;

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

            // Audit trail: log the submission itself (not just anti-cheat
            // violations) so the teacher's audit log reflects real activity.
            // `submission.getAssessment()` is a lazy proxy of the abstract
            // Assessment root — Hibernate can't proxy to the JOINED subclass
            // without a query, so `instanceof OpenTP` on it is always false.
            // Re-fetch through the repository to get the real concrete type.
            Assessment concreteAssessment = assessmentRepository
                    .findById(submission.getAssessment().getAssessmentId())
                    .orElse(submission.getAssessment());
            AuditDomain domain = concreteAssessment instanceof OpenTP ? AuditDomain.TP : AuditDomain.EXAM;
            Map<String, Object> detail = new HashMap<>();
            detail.put("problemId", submission.getProblem().getProblemId().toString());
            detail.put("verdict", result.getStatus().name());
            detail.put("points", result.getPointsAwarded());
            auditEventService.record(
                    domain,
                    "SUBMISSION",
                    submission.getAssessment().getAssessmentId(),
                    submission.getProblem().getProblemId(),
                    submission.getStudent().getId(),
                    null, null,
                    detail,
                    Severity.INFO);
        }
    }
}
