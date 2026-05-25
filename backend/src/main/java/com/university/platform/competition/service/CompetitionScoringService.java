package com.university.platform.competition.service;

import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.CompetitionProblem;
import com.university.platform.competition.model.CompetitionSubmission;
import com.university.platform.competition.model.CompetitionSubmission.Verdict;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitionScoringService {

    private final CompetitionRepository competitionRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final CompetitionSubmissionRepository competitionSubmissionRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void processResult(Submission submission, Result result) {
        UUID competitionId = submission.getCompetitionId();
        if (competitionId == null) return;

        Competition competition = competitionRepository.findById(competitionId).orElse(null);
        if (competition == null) {
            log.warn("[COMP-SCORING] Competition {} not found for submission {}", competitionId, submission.getSubmissionId());
            return;
        }

        UUID studentId = submission.getStudent().getId();
        UUID problemId = submission.getProblem().getProblemId();

        UUID teamId = null;
        if (competition.getMode() == CompetitionMode.TEAM) {
            teamId = teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).orElse(null);
        }

        Verdict verdict = mapVerdict(result);

        boolean alreadyAC = teamId != null
                ? competitionSubmissionRepository.existsByCompetitionIdAndTeamIdAndProblemIdAndVerdict(competitionId, teamId, problemId, Verdict.AC)
                : competitionSubmissionRepository.existsByCompetitionIdAndStudentIdAndProblemIdAndVerdict(competitionId, studentId, problemId, Verdict.AC);

        int attemptNumber = teamId != null
                ? competitionSubmissionRepository.countByCompetitionIdAndTeamIdAndProblemId(competitionId, teamId, problemId) + 1
                : competitionSubmissionRepository.countByCompetitionIdAndStudentIdAndProblemId(competitionId, studentId, problemId) + 1;

        int score = 0;
        if (verdict == Verdict.AC && !alreadyAC) {
            CompetitionProblem cp = competitionProblemRepository
                    .findByCompetitionIdAndProblem_ProblemId(competitionId, problemId).orElse(null);
            if (cp != null) {
                score = computeScore(cp.getPoints(), competition, submission, attemptNumber);
            }
        }

        long execTimeMs = (result.getExecutionTimeMs() != null) ? result.getExecutionTimeMs() : 0L;

        CompetitionSubmission cs = CompetitionSubmission.builder()
                .competitionId(competitionId)
                .teamId(teamId)
                .studentId(studentId)
                .problemId(problemId)
                .submissionId(submission.getSubmissionId())
                .verdict(verdict)
                .score(score)
                .attemptNumber(attemptNumber)
                .submittedAt(submission.getTimestamp())
                .executionTimeMs(execTimeMs)
                .build();

        competitionSubmissionRepository.save(cs);
        log.info("[COMP-SCORING] Saved CompetitionSubmission: comp={} student={} problem={} verdict={} score={}",
                competitionId, studentId, problemId, verdict, score);

        if (verdict == Verdict.AC) {
            pushScoreboardUpdate(competitionId);
        }
    }

    // -------------------------------------------------------------------------

    private int computeScore(int maxPoints, Competition competition, Submission submission, int attemptNumber) {
        long minutesElapsed = ChronoUnit.MINUTES.between(competition.getStartTime(), submission.getTimestamp());
        int wrongAttempts = attemptNumber - 1;
        long effectiveMinutes = minutesElapsed + (wrongAttempts * 10L);

        int floor = (int) (maxPoints * 0.3);
        int calculated = maxPoints - (int) ((maxPoints / 250.0) * effectiveMinutes);
        return Math.max(floor, calculated);
    }

    private Verdict mapVerdict(Result result) {
        ResultStatus status = result.getStatus();
        return switch (status) {
            case PASS       -> Verdict.AC;
            case FAIL       -> Verdict.WA;
            case TIME_OUT   -> Verdict.TLE;
            case MEMORY_OUT -> Verdict.MLE;
            case ERROR      -> {
                // executionTimeMs == 0 means compilation error (set explicitly in CE path)
                // executionTimeMs == null means internal runtime error
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
            log.debug("[COMP-SCORING] Scoreboard update pushed for competition {}", competitionId);
        } catch (Exception ex) {
            log.warn("[COMP-SCORING] Failed to push scoreboard update: {}", ex.getMessage());
        }
    }
}
