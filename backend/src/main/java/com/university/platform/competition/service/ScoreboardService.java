package com.university.platform.competition.service;

import com.university.platform.competition.dto.ScoreboardDTO;
import com.university.platform.competition.dto.SoloScoreboardEntryDTO;
import com.university.platform.competition.dto.TeamScoreboardEntryDTO;
import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.CompetitionAttemptStats;
import com.university.platform.competition.model.CompetitionProblem;
import com.university.platform.competition.model.CompetitionRegistration;
import com.university.platform.competition.model.CompetitionSubmission;
import com.university.platform.competition.model.CompetitionSubmission.Verdict;
import com.university.platform.competition.model.Team;
import com.university.platform.competition.model.TeamMember;
import com.university.platform.competition.repository.*;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.repository.StudentRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScoreboardService {

    private final CompetitionRepository competitionRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final CompetitionSubmissionRepository competitionSubmissionRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final CompetitionAttemptStatsRepository attemptStatsRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final StudentRepository studentRepository;

    @Transactional(readOnly = true)
    public List<?> getScoreboard(UUID competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + competitionId));

        List<CompetitionProblem> problems =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);

        List<CompetitionSubmission> allSubs =
                competitionSubmissionRepository.findByCompetitionId(competitionId);

        if (competition.getMode() == CompetitionMode.SOLO) {
            return buildSoloScoreboard(competitionId, problems, allSubs);
        } else {
            return buildTeamScoreboard(competition, problems, allSubs);
        }
    }

    // -------------------------------------------------------------------------

    private List<SoloScoreboardEntryDTO> buildSoloScoreboard(
            UUID competitionId,
            List<CompetitionProblem> problems,
            List<CompetitionSubmission> allSubs) {

        List<CompetitionRegistration> registrations =
                competitionRegistrationRepository.findByCompetitionId(competitionId);

        List<UUID> studentIds = registrations.stream().map(CompetitionRegistration::getStudentId).toList();

        Map<UUID, Student> studentMap = studentRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        // studentId → problemId → submissions
        Map<UUID, Map<UUID, List<CompetitionSubmission>>> byStudentProblem = allSubs.stream()
                .collect(Collectors.groupingBy(
                        CompetitionSubmission::getStudentId,
                        Collectors.groupingBy(CompetitionSubmission::getProblemId)
                ));

        List<SoloScoreboardEntryDTO> entries = new ArrayList<>();

        for (UUID studentId : studentIds) {
            Student student = studentMap.get(studentId);
            Map<UUID, List<CompetitionSubmission>> byProblem =
                    byStudentProblem.getOrDefault(studentId, Collections.emptyMap());

            int totalScore = 0;
            int solvedCount = 0;
            LocalDateTime lastSolveTime = null;
            List<SoloScoreboardEntryDTO.ProblemResult> problemResults = new ArrayList<>();

            for (CompetitionProblem cp : problems) {
                UUID problemId = cp.getProblem().getProblemId();
                List<CompetitionSubmission> subs = byProblem.getOrDefault(problemId, Collections.emptyList());

                CompetitionSubmission firstAc = subs.stream()
                        .filter(s -> s.getVerdict() == Verdict.AC)
                        .min(Comparator.comparing(CompetitionSubmission::getSubmittedAt))
                        .orElse(null);

                Verdict displayVerdict = firstAc != null ? Verdict.AC
                        : subs.stream().map(CompetitionSubmission::getVerdict)
                                .max(Comparator.naturalOrder()).orElse(null);

                int score = firstAc != null ? firstAc.getScore() : 0;
                LocalDateTime solvedAt = firstAc != null ? firstAc.getSubmittedAt() : null;

                if (firstAc != null) {
                    totalScore += score;
                    solvedCount++;
                    if (lastSolveTime == null || firstAc.getSubmittedAt().isAfter(lastSolveTime)) {
                        lastSolveTime = firstAc.getSubmittedAt();
                    }
                }

                problemResults.add(SoloScoreboardEntryDTO.ProblemResult.builder()
                        .label(toLabel(cp.getOrderIndex()))
                        .verdict(displayVerdict)
                        .score(score)
                        .attempts(subs.size())
                        .solvedAt(solvedAt)
                        .build());
            }

            entries.add(SoloScoreboardEntryDTO.builder()
                    .studentId(studentId)
                    .firstName(student != null ? student.getFirstName() : "")
                    .lastName(student != null ? student.getLastName() : "")
                    .totalScore(totalScore)
                    .solvedCount(solvedCount)
                    .lastSolveTime(lastSolveTime)
                    .problems(problemResults)
                    .build());
        }

        entries.sort(Comparator
                .comparingInt(SoloScoreboardEntryDTO::getTotalScore).reversed()
                .thenComparing(e -> e.getLastSolveTime() != null ? e.getLastSolveTime() : LocalDateTime.MAX));

        for (int i = 0; i < entries.size(); i++) {
            entries.get(i).setRank(i + 1);
        }
        return entries;
    }

    // -------------------------------------------------------------------------

    private List<TeamScoreboardEntryDTO> buildTeamScoreboard(
            Competition competition,
            List<CompetitionProblem> problems,
            List<CompetitionSubmission> allSubs) {

        List<Team> teams = teamRepository.findByCompetitionId(competition.getCompetitionId());

        // teamId → problemId → submissions
        Map<UUID, Map<UUID, List<CompetitionSubmission>>> byTeamProblem = allSubs.stream()
                .filter(s -> s.getTeamId() != null)
                .collect(Collectors.groupingBy(
                        CompetitionSubmission::getTeamId,
                        Collectors.groupingBy(CompetitionSubmission::getProblemId)
                ));

        // Collect all student IDs to batch-load names
        Map<UUID, List<TeamMember>> membersMap = new HashMap<>();
        Set<UUID> allStudentIds = new HashSet<>();
        for (Team team : teams) {
            List<TeamMember> members = teamMemberRepository.findByTeamId(team.getTeamId());
            membersMap.put(team.getTeamId(), members);
            members.forEach(m -> allStudentIds.add(m.getStudentId()));
        }
        Map<UUID, Student> studentMap = studentRepository.findAllById(allStudentIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        List<TeamScoreboardEntryDTO> entries = new ArrayList<>();

        for (Team team : teams) {
            List<TeamMember> members = membersMap.getOrDefault(team.getTeamId(), Collections.emptyList());
            Map<UUID, List<CompetitionSubmission>> byProblem =
                    byTeamProblem.getOrDefault(team.getTeamId(), Collections.emptyMap());

            List<TeamScoreboardEntryDTO.MemberEntry> memberEntries = members.stream()
                    .map(m -> {
                        Student s = studentMap.get(m.getStudentId());
                        return TeamScoreboardEntryDTO.MemberEntry.builder()
                                .studentId(m.getStudentId())
                                .firstName(s != null ? s.getFirstName() : "")
                                .lastName(s != null ? s.getLastName() : "")
                                .build();
                    }).toList();

            int totalScore = 0;
            int solvedCount = 0;
            LocalDateTime lastSolveTime = null;
            List<TeamScoreboardEntryDTO.ProblemResult> problemResults = new ArrayList<>();

            for (CompetitionProblem cp : problems) {
                UUID problemId = cp.getProblem().getProblemId();
                List<CompetitionSubmission> subs = byProblem.getOrDefault(problemId, Collections.emptyList());

                CompetitionSubmission firstAc = subs.stream()
                        .filter(s -> s.getVerdict() == Verdict.AC)
                        .min(Comparator.comparing(CompetitionSubmission::getSubmittedAt))
                        .orElse(null);

                Verdict displayVerdict = firstAc != null ? Verdict.AC
                        : subs.stream().map(CompetitionSubmission::getVerdict)
                                .max(Comparator.naturalOrder()).orElse(null);

                int score = firstAc != null ? firstAc.getScore() : 0;
                LocalDateTime solvedAt = firstAc != null ? firstAc.getSubmittedAt() : null;

                if (firstAc != null) {
                    totalScore += score;
                    solvedCount++;
                    if (lastSolveTime == null || firstAc.getSubmittedAt().isAfter(lastSolveTime)) {
                        lastSolveTime = firstAc.getSubmittedAt();
                    }
                }

                problemResults.add(TeamScoreboardEntryDTO.ProblemResult.builder()
                        .label(toLabel(cp.getOrderIndex()))
                        .verdict(displayVerdict)
                        .score(score)
                        .attempts(subs.size())
                        .solvedAt(solvedAt)
                        .build());
            }

            entries.add(TeamScoreboardEntryDTO.builder()
                    .teamId(team.getTeamId())
                    .teamName(team.getName())
                    .members(memberEntries)
                    .totalScore(totalScore)
                    .solvedCount(solvedCount)
                    .lastSolveTime(lastSolveTime)
                    .problems(problemResults)
                    .build());
        }

        entries.sort(Comparator
                .comparingInt(TeamScoreboardEntryDTO::getTotalScore).reversed()
                .thenComparing(e -> e.getLastSolveTime() != null ? e.getLastSolveTime() : LocalDateTime.MAX));

        for (int i = 0; i < entries.size(); i++) {
            entries.get(i).setRank(i + 1);
        }
        return entries;
    }

    // =========================================================================
    //  Full mode-aware scoreboard (ICPC / RATED / PARTIAL) — built from
    //  competition_attempt_stats. Students see a freeze snapshot during freeze;
    //  teachers always see live standings.
    // =========================================================================

    @Transactional(readOnly = true)
    public ScoreboardDTO getFullScoreboard(UUID competitionId, boolean isTeacher) {
        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + competitionId));

        boolean frozen = !isTeacher && comp.isScoreboardFrozen();
        LocalDateTime freezeAt = comp.getFreezeAt();
        Competition.ScoringMode scoringMode = comp.getScoringMode();
        boolean isTeamMode = comp.getMode() == CompetitionMode.TEAM;

        List<CompetitionProblem> problems =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);

        // problemId → column
        List<ScoreboardDTO.ProblemColumn> columns = problems.stream()
                .map(cp -> ScoreboardDTO.ProblemColumn.builder()
                        .problemId(cp.getProblem().getProblemId())
                        .label(toLabel(cp.getOrderIndex()))
                        .title(cp.getProblem().getTitle())
                        .maxPoints(cp.getMaxPoints())
                        .firstBloodParticipantId(cp.getFirstBloodParticipantId())
                        .build())
                .toList();

        // participantId → problemId → stats
        Map<UUID, Map<UUID, CompetitionAttemptStats>> byParticipant = new HashMap<>();
        for (CompetitionAttemptStats s : attemptStatsRepository.findByCompetitionId(competitionId)) {
            byParticipant.computeIfAbsent(s.getParticipantId(), k -> new HashMap<>())
                    .put(s.getProblemId(), s);
        }

        // Build participant identity rows
        List<ParticipantIdentity> participants = isTeamMode
                ? loadTeamParticipants(competitionId)
                : loadSoloParticipants(competitionId);

        List<ScoreboardDTO.Row> rows = new ArrayList<>();
        for (ParticipantIdentity p : participants) {
            Map<UUID, CompetitionAttemptStats> stats =
                    byParticipant.getOrDefault(p.id(), Collections.emptyMap());

            Map<String, ScoreboardDTO.ProblemCellDTO> cells = new HashMap<>();
            int rowScore = 0;
            int rowPenalty = 0;
            int solvedCount = 0;
            LocalDateTime lastSolve = null;

            for (CompetitionProblem cp : problems) {
                UUID pid = cp.getProblem().getProblemId();
                CompetitionAttemptStats st = stats.get(pid);

                boolean countSolve = st != null && st.isSolved()
                        && (!frozen || (st.getFirstSolvedAt() != null
                                        && freezeAt != null
                                        && st.getFirstSolvedAt().isBefore(freezeAt)));

                boolean firstBlood = st != null
                        && cp.getFirstBloodParticipantId() != null
                        && cp.getFirstBloodParticipantId().equals(p.id())
                        && countSolve;

                Integer solvedAtMinute = null;
                if (countSolve && st.getFirstSolvedAt() != null && comp.getStartTime() != null) {
                    solvedAtMinute = (int) Math.max(0,
                            ChronoUnit.MINUTES.between(comp.getStartTime(), st.getFirstSolvedAt()));
                }

                int cellScore = 0;
                int cellPenalty = 0;
                if (st != null) {
                    switch (scoringMode) {
                        case ICPC -> {
                            if (countSolve) {
                                solvedCount++;
                                cellPenalty = st.getPenaltyMinutes();
                                rowPenalty += cellPenalty;
                                rowScore = solvedCount;
                            }
                        }
                        case RATED, PARTIAL -> {
                            // Show score only if solved-before-freeze, or not frozen.
                            boolean show = !frozen || countSolve;
                            if (show) {
                                cellScore = st.getBestScore();
                                rowScore += cellScore;
                            }
                            if (countSolve) solvedCount++;
                        }
                    }
                    if (countSolve && st.getFirstSolvedAt() != null
                            && (lastSolve == null || st.getFirstSolvedAt().isAfter(lastSolve))) {
                        lastSolve = st.getFirstSolvedAt();
                    }
                }

                cells.put(pid.toString(), ScoreboardDTO.ProblemCellDTO.builder()
                        .solved(countSolve)
                        .attempted(st != null && (st.getWrongAttempts() > 0 || st.isSolved() || st.getLastScore() > 0))
                        .wrongAttempts(st != null ? st.getWrongAttempts() : 0)
                        .score(cellScore)
                        .penaltyMinutes(cellPenalty)
                        .firstBlood(firstBlood)
                        .solvedAtMinute(solvedAtMinute)
                        .build());
            }

            rows.add(ScoreboardDTO.Row.builder()
                    .participantId(p.id())
                    .name(p.name())
                    .members(p.members())
                    .score(rowScore)
                    .penaltyMinutes(rowPenalty)
                    .solvedCount(solvedCount)
                    .cells(cells)
                    .build());
        }

        // Sort + rank
        Comparator<ScoreboardDTO.Row> cmp;
        if (scoringMode == Competition.ScoringMode.ICPC) {
            cmp = Comparator
                    .comparingInt(ScoreboardDTO.Row::getSolvedCount).reversed()
                    .thenComparingInt(ScoreboardDTO.Row::getPenaltyMinutes);
        } else {
            cmp = Comparator
                    .comparingInt(ScoreboardDTO.Row::getScore).reversed();
        }
        rows.sort(cmp);
        for (int i = 0; i < rows.size(); i++) rows.get(i).setRank(i + 1);

        return ScoreboardDTO.builder()
                .competitionId(competitionId)
                .scoringMode(scoringMode.name())
                .mode(comp.getMode().name())
                .frozen(frozen)
                .freezeAt(freezeAt != null ? freezeAt.toString() : null)
                .problems(columns)
                .rows(rows)
                .build();
    }

    // ── participant loaders ──────────────────────────────────────────────────

    private record ParticipantIdentity(UUID id, String name, List<ScoreboardDTO.MemberDTO> members) {}

    private List<ParticipantIdentity> loadTeamParticipants(UUID competitionId) {
        List<Team> teams = teamRepository.findByCompetitionId(competitionId);
        Set<UUID> studentIds = new HashSet<>();
        Map<UUID, List<TeamMember>> membersByTeam = new HashMap<>();
        for (Team t : teams) {
            List<TeamMember> members = teamMemberRepository.findByTeamId(t.getTeamId());
            membersByTeam.put(t.getTeamId(), members);
            members.forEach(m -> studentIds.add(m.getStudentId()));
        }
        Map<UUID, Student> studentMap = studentRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        return teams.stream().map(t -> {
            List<ScoreboardDTO.MemberDTO> members = membersByTeam.getOrDefault(t.getTeamId(), List.of())
                    .stream().map(m -> {
                        Student s = studentMap.get(m.getStudentId());
                        return ScoreboardDTO.MemberDTO.builder()
                                .studentId(m.getStudentId())
                                .firstName(s != null ? s.getFirstName() : "")
                                .lastName(s != null ? s.getLastName() : "")
                                .build();
                    }).toList();
            return new ParticipantIdentity(t.getTeamId(), t.getName(), members);
        }).toList();
    }

    private List<ParticipantIdentity> loadSoloParticipants(UUID competitionId) {
        List<CompetitionRegistration> regs =
                competitionRegistrationRepository.findByCompetitionId(competitionId);
        List<UUID> studentIds = regs.stream().map(CompetitionRegistration::getStudentId).toList();
        Map<UUID, Student> studentMap = studentRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        return studentIds.stream().map(sid -> {
            Student s = studentMap.get(sid);
            String name = s != null ? (s.getFirstName() + " " + s.getLastName()).trim() : "Unknown";
            return new ParticipantIdentity(sid, name, List.of());
        }).toList();
    }

    // -------------------------------------------------------------------------

    private String toLabel(int orderIndex) {
        return String.valueOf((char) ('A' + orderIndex));
    }
}
