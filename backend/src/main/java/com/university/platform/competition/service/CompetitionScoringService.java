package com.university.platform.competition.service;

import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.CompetitionAttemptStats;
import com.university.platform.competition.model.CompetitionProblem;
import com.university.platform.competition.model.CompetitionSubmission;
import com.university.platform.competition.model.CompetitionSubmission.Verdict;
import com.university.platform.competition.repository.CompetitionAttemptStatsRepository;
import com.university.platform.competition.repository.CompetitionProblemRepository;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.competition.repository.CompetitionSubmissionRepository;
import com.university.platform.competition.repository.TeamMemberRepository;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;
import com.university.platform.execution.model.Submission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * Competition scoring. Three modes, selected per competition:
 *
 *   ICPC    — rank by #solved, tie-break by penalty minutes
 *             (minutesSinceStart + wrongAttempts × wrongPenalty).
 *   RATED   — decremental points: max(min, max − decay×min − wrongPenalty×wrong).
 *   PARTIAL — score = round(passed/total × max); best submission counts.
 *
 * The per-participant aggregate ({@link CompetitionAttemptStats}) is the source
 * of truth for the scoreboard. {@link CompetitionSubmission} rows are still
 * written as the immutable submission history (unchanged behaviour).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitionScoringService {

    private final CompetitionRepository competitionRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final CompetitionSubmissionRepository competitionSubmissionRepository;
    private final CompetitionAttemptStatsRepository attemptStatsRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * @param passedCount number of test cases that passed (for PARTIAL)
     * @param totalCount  total test cases run (for PARTIAL)
     */
    // Joins the caller's single scoring transaction (see SubmissionScoringDispatcher).
    // The per-participant stat row is locked FOR UPDATE for the duration of the
    // update so teammates sharing one row cannot lose each other's writes.
    @Transactional
    public void processResult(Submission submission, Result result, int passedCount, int totalCount) {
        UUID competitionId = submission.getCompetitionId();
        if (competitionId == null) return;

        Competition competition = competitionRepository.findById(competitionId).orElse(null);
        if (competition == null) {
            log.warn("[COMP-SCORING] Competition {} not found for submission {}",
                    competitionId, submission.getSubmissionId());
            return;
        }

        UUID studentId = submission.getStudent().getId();
        UUID problemId = submission.getProblem().getProblemId();
        boolean isTeamMode = competition.getMode() == CompetitionMode.TEAM;

        UUID teamId = null;
        if (isTeamMode) {
            teamId = teamMemberRepository
                    .findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).orElse(null);
        }
        UUID participantId = isTeamMode ? teamId : studentId;

        Verdict verdict = mapVerdict(result);
        boolean allPassed = verdict == Verdict.AC;

        int attemptNumber = isTeamMode
                ? competitionSubmissionRepository.countByCompetitionIdAndTeamIdAndProblemId(competitionId, teamId, problemId) + 1
                : competitionSubmissionRepository.countByCompetitionIdAndStudentIdAndProblemId(competitionId, studentId, problemId) + 1;

        int submissionScore = 0;
        CompetitionProblem cp = competitionProblemRepository
                .findByCompetitionIdAndProblem_ProblemId(competitionId, problemId).orElse(null);

        if (participantId != null && cp != null) {
            CompetitionAttemptStats stats = lockOrCreate(competitionId, problemId, participantId, isTeamMode);
            submissionScore = switch (competition.getScoringMode()) {
                case ICPC    -> scoreIcpc(competition, cp, stats, allPassed, submission.getTimestamp());
                case RATED   -> scoreRated(competition, cp, stats, allPassed, submission.getTimestamp());
                case PARTIAL -> scorePartial(cp, stats, passedCount, totalCount, submission.getTimestamp());
            };
        }

        long execTimeMs = (result.getExecutionTimeMs() != null) ? result.getExecutionTimeMs() : 0L;

        CompetitionSubmission cs = CompetitionSubmission.builder()
                .competitionId(competitionId)
                .teamId(teamId)
                .studentId(studentId)
                .problemId(problemId)
                .submissionId(submission.getSubmissionId())
                .verdict(verdict)
                .score(submissionScore)
                .attemptNumber(attemptNumber)
                .submittedAt(submission.getTimestamp())
                .executionTimeMs(execTimeMs)
                .build();
        competitionSubmissionRepository.save(cs);

        log.info("[COMP-SCORING] comp={} mode={} participant={} problem={} verdict={} score={}",
                competitionId, competition.getScoringMode(), participantId, problemId, verdict, submissionScore);

        pushScoreboardUpdate(competitionId);
    }

    // ── ICPC ─────────────────────────────────────────────────────────────────

    private int scoreIcpc(Competition comp, CompetitionProblem cp,
                          CompetitionAttemptStats stats, boolean allPassed, LocalDateTime submittedAt) {
        if (stats.isSolved()) return cp.getMaxPoints();

        if (!allPassed) {
            stats.setWrongAttempts(stats.getWrongAttempts() + 1);
            stats.setLastScore(0);
            attemptStatsRepository.save(stats);
            return 0;
        }

        long minutes = Math.max(0, ChronoUnit.MINUTES.between(comp.getStartTime(), submittedAt));
        int penalty = (int) minutes + (stats.getWrongAttempts() * cp.getWrongPenalty());

        stats.setSolved(true);
        stats.setFirstSolvedAt(submittedAt);
        stats.setPenaltyMinutes(penalty);
        stats.setBestScore(1);   // 1 = solved; ICPC ranks by solved count
        stats.setLastScore(1);
        attemptStatsRepository.save(stats);

        maybeFirstBlood(cp, stats, submittedAt);
        return cp.getMaxPoints();
    }

    // ── PARTIAL ──────────────────────────────────────────────────────────────

    private int scorePartial(CompetitionProblem cp, CompetitionAttemptStats stats,
                             int passed, int total, LocalDateTime submittedAt) {
        if (total <= 0) return 0;

        int newScore = (int) Math.round(((double) passed / total) * cp.getMaxPoints());
        stats.setLastScore(newScore);

        if (newScore > stats.getBestScore()) {
            stats.setBestScore(newScore);
        }
        if (!stats.isSolved() && passed == total) {
            stats.setSolved(true);
            stats.setFirstSolvedAt(submittedAt);
            maybeFirstBlood(cp, stats, submittedAt);
        }
        attemptStatsRepository.save(stats);
        return newScore;
    }

    // ── RATED ────────────────────────────────────────────────────────────────

    private int scoreRated(Competition comp, CompetitionProblem cp,
                           CompetitionAttemptStats stats, boolean allPassed, LocalDateTime submittedAt) {
        if (stats.isSolved()) return stats.getBestScore();

        if (!allPassed) {
            stats.setWrongAttempts(stats.getWrongAttempts() + 1);
            stats.setLastScore(0);
            attemptStatsRepository.save(stats);
            return 0;
        }

        long minutes = Math.max(0, ChronoUnit.MINUTES.between(comp.getStartTime(), submittedAt));
        BigDecimal decay = cp.getDecayPerMin() != null ? cp.getDecayPerMin() : BigDecimal.ZERO;
        int rawScore = cp.getMaxPoints()
                - decay.multiply(BigDecimal.valueOf(minutes)).intValue()
                - (cp.getWrongPenalty() * stats.getWrongAttempts());
        int finalScore = Math.max(cp.getMinPoints(), rawScore);

        stats.setSolved(true);
        stats.setFirstSolvedAt(submittedAt);
        stats.setBestScore(finalScore);
        stats.setLastScore(finalScore);
        attemptStatsRepository.save(stats);

        maybeFirstBlood(cp, stats, submittedAt);
        return finalScore;
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * Ensure the (competition, problem, participant) row exists and return it
     * locked FOR UPDATE. The upsert is race-free (ON CONFLICT DO NOTHING) so
     * two teammates inserting concurrently can't deadlock or throw; the
     * subsequent locked read serialises their field updates.
     */
    private CompetitionAttemptStats lockOrCreate(UUID competitionId, UUID problemId,
                                                 UUID participantId, boolean isTeam) {
        attemptStatsRepository.insertIfAbsent(competitionId, problemId, participantId, isTeam);
        return attemptStatsRepository
                .findForUpdate(competitionId, problemId, participantId)
                .orElseThrow(() -> new IllegalStateException(
                        "attempt-stats row missing after upsert for participant " + participantId));
    }

    /**
     * Atomic first-blood claim — a single guarded UPDATE decides the unique
     * winner under concurrency (no read-then-set).
     */
    private void maybeFirstBlood(CompetitionProblem cp, CompetitionAttemptStats stats, LocalDateTime at) {
        int claimed = competitionProblemRepository.claimFirstBlood(cp.getId(), stats.getParticipantId(), at);
        if (claimed > 0) {
            log.info("[COMP-SCORING] First blood on problem {} by participant {}",
                    cp.getProblem().getProblemId(), stats.getParticipantId());
        }
    }

    private Verdict mapVerdict(Result result) {
        ResultStatus status = result.getStatus();
        return switch (status) {
            case PASS       -> Verdict.AC;
            case FAIL       -> Verdict.WA;
            case TIME_OUT   -> Verdict.TLE;
            case MEMORY_OUT -> Verdict.MLE;
            case ERROR      -> {
                Integer execMs = result.getExecutionTimeMs();
                yield (execMs != null && execMs == 0) ? Verdict.CE : Verdict.RTE;
            }
        };
    }

    private void pushScoreboardUpdate(UUID competitionId) {
        try {
            messagingTemplate.convertAndSend(
                    "/topic/competitions/" + competitionId + "/scoreboard",
                    Map.of("competitionId", competitionId.toString(), "event", "SCOREBOARD_UPDATE")
            );
        } catch (Exception ex) {
            log.warn("[COMP-SCORING] Failed to push scoreboard update: {}", ex.getMessage());
        }
    }
}
