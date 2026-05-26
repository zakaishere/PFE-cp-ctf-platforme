package com.university.platform.ctf.service;

import com.university.platform.ctf.dto.*;
import com.university.platform.ctf.entity.*;
import com.university.platform.ctf.exception.CTFPausedException;
import com.university.platform.ctf.repository.*;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.data.domain.PageRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Transactional
public class CTFCompetitionService {

    private static final Logger log = LoggerFactory.getLogger(CTFCompetitionService.class);

    private static final int  RATE_LIMIT_MAX    = 5;
    private static final long RATE_LIMIT_WINDOW  = 5 * 60 * 1000L;
    private static final int  FEED_MAX_SIZE      = 20;

    private final ConcurrentHashMap<String, List<Long>>                   wrongAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, java.util.Deque<CTFFeedEventDTO>> feedCache   = new ConcurrentHashMap<>();

    private final CTFCompetitionRepository      competitionRepo;
    private final CTFChallengeRepository        challengeRepo;
    private final CTFTeamRepository             teamRepo;
    private final CTFTeamMemberRepository       memberRepo;
    private final CTFTeamFlagRepository         flagRepo;
    private final CTFCompetitionSolveRepository solveRepo;
    private final CTFCheatEventRepository       cheatRepo;
    private final CTFSubmissionRepository       submissionRepo;
    private final CTFAwardRepository            awardRepo;
    private final CTFHintUnlockRepository       hintUnlockRepo;
    private final CTFScoringEngine              scoringEngine;
    private final CTFTeamService                teamService;
    private final CTFInstanceService            instanceService;
    private final SimpMessagingTemplate         ws;

    public CTFCompetitionService(CTFCompetitionRepository competitionRepo,
                                 CTFChallengeRepository challengeRepo,
                                 CTFTeamRepository teamRepo,
                                 CTFTeamMemberRepository memberRepo,
                                 CTFTeamFlagRepository flagRepo,
                                 CTFCompetitionSolveRepository solveRepo,
                                 CTFCheatEventRepository cheatRepo,
                                 CTFSubmissionRepository submissionRepo,
                                 CTFAwardRepository awardRepo,
                                 CTFHintUnlockRepository hintUnlockRepo,
                                 CTFScoringEngine scoringEngine,
                                 CTFTeamService teamService,
                                 CTFInstanceService instanceService,
                                 SimpMessagingTemplate ws) {
        this.competitionRepo = competitionRepo;
        this.challengeRepo   = challengeRepo;
        this.teamRepo        = teamRepo;
        this.memberRepo      = memberRepo;
        this.flagRepo        = flagRepo;
        this.solveRepo       = solveRepo;
        this.cheatRepo       = cheatRepo;
        this.submissionRepo  = submissionRepo;
        this.awardRepo       = awardRepo;
        this.hintUnlockRepo  = hintUnlockRepo;
        this.scoringEngine   = scoringEngine;
        this.teamService     = teamService;
        this.instanceService = instanceService;
        this.ws              = ws;
    }

    // ── Score timeline ─────────────────────────────────────────────────────────

    /**
     * Builds the cumulative score timeline for the top-N teams.
     * Returns one data point per award event, with each point carrying the
     * cumulative score at that moment.  Freeze-aware: if the scoreboard is
     * frozen, only awards up to frozenAt are included (matches the live view).
     */
    public CTFScoreTimelineDTO getScoreTimeline(UUID competitionId, int topN) {
        CTFCompetition comp = requireCompetition(competitionId);
        int capped = Math.min(Math.max(topN, 1), 20);

        LocalDateTime freezeTime = Boolean.TRUE.equals(comp.getIsFrozen())
                ? comp.getFrozenAt() : null;

        List<Object[]> rows = awardRepo.findCumulativeScoreTimeline(
                competitionId, capped, freezeTime);

        Map<UUID, CTFTeam> teamMap = teamRepo.findByCompetitionId(competitionId)
                .stream().collect(Collectors.toMap(CTFTeam::getId, t -> t));

        // Group by team_id in insertion order (query returns team_id, awarded_at, cumulative)
        Map<UUID, List<CTFScoreTimelineDTO.ScorePoint>> byTeam = new LinkedHashMap<>();
        for (Object[] row : rows) {
            UUID teamId = row[0] instanceof UUID ? (UUID) row[0]
                    : UUID.fromString(row[0].toString());
            String timeStr = row[1] instanceof java.sql.Timestamp
                    ? ((java.sql.Timestamp) row[1]).toLocalDateTime().toString()
                    : row[1].toString();
            int score = ((Number) row[2]).intValue();
            byTeam.computeIfAbsent(teamId, k -> new ArrayList<>())
                  .add(CTFScoreTimelineDTO.ScorePoint.builder()
                      .time(timeStr).score(score).build());
        }

        List<CTFScoreTimelineDTO.TeamTimeline> timelines = byTeam.entrySet().stream()
                .map(e -> {
                    CTFTeam t = teamMap.get(e.getKey());
                    return CTFScoreTimelineDTO.TeamTimeline.builder()
                            .teamId(e.getKey())
                            .teamName(t != null ? t.getName() : "Unknown")
                            .accentColor(t != null ? t.getAvatarColor() : "#6366f1")
                            .points(e.getValue())
                            .build();
                })
                .collect(Collectors.toList());

        return CTFScoreTimelineDTO.builder()
                .teams(timelines)
                .competitionStart(comp.getStartTime() != null
                        ? comp.getStartTime().toString() : null)
                .competitionEnd(comp.getEffectiveEndTime() != null
                        ? comp.getEffectiveEndTime().toString() : null)
                .build();
    }

    // ── Listing ────────────────────────────────────────────────────────────────

    public List<CTFCompetitionDTO> listActive() {
        return competitionRepo.findByIsActiveTrueOrderByStartTimeDesc().stream()
                .map(CTFCompetitionDTO::from)
                .collect(Collectors.toList());
    }

    public List<CTFFeedEventDTO> getFeed(UUID competitionId) {
        requireCompetition(competitionId);
        java.util.Deque<CTFFeedEventDTO> deque = feedCache.getOrDefault(competitionId, new java.util.ArrayDeque<>());
        return new ArrayList<>(deque);
    }

    public CTFCompetitionDTO getCompetition(UUID competitionId, UUID userId) {
        CTFCompetition comp = requireCompetition(competitionId);
        CTFCompetition.Status status = comp.computeStatus();

        CTFCompetitionDTO dto = CTFCompetitionDTO.from(comp);

        CTFTeamResponse myTeam = null;
        if (userId != null) {
            try { myTeam = teamService.getMyTeam(competitionId, userId); } catch (Exception ignored) {}
        }
        dto.setMyTeam(myTeam);

        boolean inTeam = myTeam != null;
        dto.setCanEnterArena(
                inTeam && (status == CTFCompetition.Status.ACTIVE || status == CTFCompetition.Status.FROZEN));

        return dto;
    }

    public CTFCompetitionDTO getCompetition(UUID competitionId) {
        return getCompetition(competitionId, null);
    }

    public CTFCompetitionDTO joinByAccessCode(String rawCode) {
        if (rawCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Access code required.");
        }
        String code = rawCode.trim();
        if (code.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Access code required.");
        }
        CTFCompetition comp = competitionRepo.findByAccessCodeIgnoreCase(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Invalid or expired access code."));
        return CTFCompetitionDTO.from(comp);
    }

    // ── Status ─────────────────────────────────────────────────────────────────

    public CTFCompetitionStatusDTO getStatus(UUID competitionId, UUID userIdOrNull) {
        CTFCompetition comp = requireCompetition(competitionId);
        CTFCompetition.Status status = comp.computeStatus();

        UUID myTeamId = null;
        if (userIdOrNull != null) {
            myTeamId = memberRepo.findByCompetitionIdAndUserId(competitionId, userIdOrNull)
                    .map(m -> m.getId().getTeamId())
                    .orElse(null);
        }

        boolean canEnterArena = myTeamId != null
                && (status == CTFCompetition.Status.ACTIVE || status == CTFCompetition.Status.FROZEN);
        // Mirrors CTFCompetitionDTO.from() logic: registrationOpen flag on the entity
        // allows teams to join any time until ENDED; without it, only UPCOMING allows registration.
        boolean registrationOpen = Boolean.TRUE.equals(comp.getRegistrationOpen())
                ? status != CTFCompetition.Status.ENDED
                : status == CTFCompetition.Status.UPCOMING;

        return CTFCompetitionStatusDTO.builder()
                .id(comp.getId())
                .status(status.name())
                .startTime(comp.getStartTime())
                .endTime(comp.getEndTime())
                .myTeamId(myTeamId)
                .canEnterArena(canEnterArena)
                .registrationOpen(registrationOpen)
                .participantCount(memberRepo.countParticipantsByCompetition(competitionId))
                .teamCount(teamRepo.countByCompetitionId(competitionId))
                .isPaused(Boolean.TRUE.equals(comp.getIsPaused()))
                .isFrozen(Boolean.TRUE.equals(comp.getIsFrozen()))
                .pausedAt(comp.getPausedAt())
                .frozenAt(comp.getFrozenAt())
                .build();
    }

    // ── Challenges ─────────────────────────────────────────────────────────────

    public CTFChallengeListResponse getCompetitionChallenges(UUID competitionId, UUID userId) {
        CTFCompetition comp = requireCompetition(competitionId);
        CTFCompetition.Status status = comp.computeStatus();

        if (status == CTFCompetition.Status.UPCOMING) {
            List<CTFChallenge> all = challengeRepo
                    .findByCompetitionIdAndIsActiveTrueAndDeletedFalse(competitionId);
            Map<String, Integer> counts = new LinkedHashMap<>();
            for (CTFChallenge c : all) {
                counts.merge(c.getCategory().name(), 1, Integer::sum);
            }
            return CTFChallengeListResponse.builder()
                    .status(status.name())
                    .message("Challenges will be revealed when competition starts")
                    .challenges(Collections.emptyList())
                    .categoryCounts(counts)
                    .build();
        }

        Optional<CTFTeamMember> membership = userId == null
                ? Optional.empty()
                : memberRepo.findByCompetitionIdAndUserId(competitionId, userId);
        UUID teamId = membership.map(m -> m.getId().getTeamId()).orElse(null);

        Set<UUID> solvedChallengeIds = teamId != null
                ? solveRepo.findByCompetitionIdAndTeamId(competitionId, teamId)
                    .stream().map(CTFCompetitionSolve::getChallengeId).collect(Collectors.toSet())
                : Collections.emptySet();

        List<CTFChallenge> visible = (status == CTFCompetition.Status.ENDED)
                ? challengeRepo.findByCompetitionIdAndDeletedFalse(competitionId)
                : challengeRepo.findByCompetitionIdAndIsActiveTrueAndDeletedFalseAndIsHiddenFalse(competitionId);

        // When frozen, show challenge values as they were at the freeze moment so players
        // cannot infer score movement.  Solved/unsolved status always reflects reality.
        LocalDateTime asOf = (status == CTFCompetition.Status.FROZEN && comp.getFrozenAt() != null)
                ? comp.getFrozenAt() : null;

        // Load the set of hint IDs this team has already unlocked (single bulk query).
        // Empty when the user isn't in a team — all hints will appear locked.
        List<UUID> visibleIds = visible.stream().map(CTFChallenge::getId).collect(Collectors.toList());
        Set<String> unlockedHintIds = (teamId != null && !visibleIds.isEmpty())
                ? hintUnlockRepo.findHintIdsByTeamIdAndChallengeIdIn(teamId, visibleIds)
                : Collections.emptySet();

        List<CTFChallengeDTO> dtos = visible.stream()
                .map(c -> buildChallengeDTO(c, solvedChallengeIds.contains(c.getId()), comp, asOf, unlockedHintIds))
                .collect(Collectors.toList());

        String message = switch (status) {
            case PAUSED -> "Competition is paused — submissions are disabled";
            case FROZEN -> "Scoreboard frozen — solving continues";
            case ENDED  -> "Competition has ended";
            default     -> null;
        };

        return CTFChallengeListResponse.builder()
                .status(status.name())
                .message(message)
                .challenges(dtos)
                .categoryCounts(null)
                .build();
    }

    public List<CTFChallengeDTO> getChallenges(UUID competitionId, UUID userId) {
        return getCompetitionChallenges(competitionId, userId).getChallenges();
    }

    public List<CTFChallengeSolverDTO> getChallengeSolvers(UUID competitionId, UUID challengeId) {
        List<CTFCompetitionSolve> solves = solveRepo
                .findByCompetitionIdAndChallengeIdOrderBySolvedAtAsc(competitionId, challengeId);
        Map<UUID, CTFTeam> teamMap = teamRepo.findByCompetitionId(competitionId).stream()
                .collect(Collectors.toMap(CTFTeam::getId, t -> t));
        return solves.stream()
                .map(s -> {
                    CTFTeam team = teamMap.get(s.getTeamId());
                    if (team == null) return null;
                    return CTFChallengeSolverDTO.builder()
                            .teamId(s.getTeamId())
                            .teamName(team.getName())
                            .avatarColor(team.getAvatarColor())
                            .solvedAt(s.getSolvedAt())
                            .build();
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    // ── Scoreboard ──────────────────────────────────────────────────────────────

    /**
     * Player-facing scoreboard: respects the freeze timestamp when frozen.
     * While frozen, returns scores/rankings as they were at {@code frozenAt},
     * so players cannot infer which teams solved challenges after the freeze.
     */
    public List<CTFScoreboardEntryDTO> getScoreboard(UUID competitionId) {
        CTFCompetition comp = requireCompetition(competitionId);
        CTFCompetition.Status status = comp.computeStatus();
        LocalDateTime freezeAt = (status == CTFCompetition.Status.FROZEN && comp.getFrozenAt() != null)
                ? comp.getFrozenAt() : null;
        return buildScoreboard(competitionId, comp, freezeAt);
    }

    /**
     * Admin/teacher live scoreboard: always computes from all solves regardless of
     * freeze state.  Use this for the control-panel view so organizers can see
     * what happened during the freeze.
     */
    public List<CTFScoreboardEntryDTO> getScoreboardLive(UUID competitionId) {
        CTFCompetition comp = requireCompetition(competitionId);
        return buildScoreboard(competitionId, comp, null);
    }

    private List<CTFScoreboardEntryDTO> buildScoreboard(UUID competitionId,
                                                         CTFCompetition comp,
                                                         LocalDateTime freezeAt) {
        // 1. Load solves (capped at freezeAt when supplied)
        List<CTFCompetitionSolve> allSolves = (freezeAt != null)
                ? solveRepo.findByCompetitionIdAndSolvedAtLessThanEqualOrderBySolvedAtAsc(competitionId, freezeAt)
                : solveRepo.findByCompetitionIdOrderBySolvedAtAsc(competitionId);

        // 2. Aggregate per-challenge solve count and per-team data
        Map<UUID, Integer>       challengeSolveCounts = new HashMap<>();
        Map<UUID, Set<UUID>>     teamSolvedChallenges = new HashMap<>();
        Map<UUID, LocalDateTime> teamLastSolveAt      = new HashMap<>();

        for (CTFCompetitionSolve s : allSolves) {
            challengeSolveCounts.merge(s.getChallengeId(), 1, Integer::sum);
            teamSolvedChallenges.computeIfAbsent(s.getTeamId(), k -> new HashSet<>())
                    .add(s.getChallengeId());
            teamLastSolveAt.merge(s.getTeamId(), s.getSolvedAt(),
                    (a, b) -> a.isAfter(b) ? a : b);
        }

        // 3. Compute dynamic challenge values using the (possibly frozen) solve counts
        List<CTFChallenge> challenges = challengeRepo.findByCompetitionIdAndDeletedFalse(competitionId);
        Map<UUID, Integer> challengeCurrentValue = scoringEngine.challengeValues(comp, challenges, challengeSolveCounts);

        // 4. Hint deductions — also capped at freezeAt when supplied
        List<CTFAward> hintAwards = (freezeAt != null)
                ? awardRepo.findByCompetitionIdAndAwardedAtLessThanEqualAndReasonStartingWith(
                        competitionId, freezeAt, "hint:")
                : awardRepo.findByCompetitionIdAndReasonStartingWith(competitionId, "hint:");
        Map<UUID, Integer> hintDeductions = new HashMap<>();
        for (CTFAward a : hintAwards) {
            hintDeductions.merge(a.getTeamId(), a.getValue(), Integer::sum);
        }

        // 5. Build per-team entries
        List<CTFTeam> teams = teamRepo.findByCompetitionId(competitionId);
        List<CTFScoreboardEntryDTO> board = new ArrayList<>();
        for (CTFTeam team : teams) {
            Set<UUID> solved = teamSolvedChallenges.getOrDefault(team.getId(), Set.of());
            int score = solved.stream()
                    .mapToInt(cid -> challengeCurrentValue.getOrDefault(cid, 0))
                    .sum();
            score += hintDeductions.getOrDefault(team.getId(), 0);

            board.add(CTFScoreboardEntryDTO.builder()
                    .teamId(team.getId())
                    .teamName(team.getName())
                    .avatarColor(team.getAvatarColor())
                    .totalPoints(score)
                    .solveCount(solved.size())
                    .membersCount(memberRepo.countByIdTeamId(team.getId()))
                    .lastSolveAt(teamLastSolveAt.get(team.getId()))
                    .build());
        }

        board.sort(Comparator
                .comparingInt(CTFScoreboardEntryDTO::getTotalPoints).reversed()
                .thenComparing(e -> e.getLastSolveAt() != null ? e.getLastSolveAt() : LocalDateTime.MAX));

        for (int i = 0; i < board.size(); i++) {
            board.get(i).setRank(i + 1);
        }
        return board;
    }

    // ── Flag submission ────────────────────────────────────────────────────────

    public CTFCompetitionSubmitResponse submitFlag(UUID competitionId, UUID challengeId,
                                                    UUID userId, CTFCompetitionSubmitRequest req,
                                                    String ipAddress) {
        CTFCompetition comp = requireCompetition(competitionId);
        LocalDateTime now   = LocalDateTime.now();

        // Use computeStatus() — handles MANUAL/REGISTRATION null dates correctly.
        CTFCompetition.Status status = comp.computeStatus();
        if (status == CTFCompetition.Status.PAUSED) {
            throw new CTFPausedException("Competition is currently paused");
        }
        if (status == CTFCompetition.Status.UPCOMING) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Competition has not started yet.");
        }
        if (status == CTFCompetition.Status.ENDED) {
            throw new ResponseStatusException(HttpStatus.GONE, "This competition has ended.");
        }

        CTFTeamMember membership = memberRepo.findByCompetitionIdAndUserId(competitionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You must be in a team to submit flags."));
        UUID teamId = membership.getId().getTeamId();

        CTFChallenge challenge = challengeRepo.findByIdAndDeletedFalse(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found."));
        if (!competitionId.equals(challenge.getCompetitionId())) {
            throw new EntityNotFoundException("Challenge not part of this competition.");
        }

        if (solveRepo.existsByCompetitionIdAndChallengeIdAndTeamId(competitionId, challengeId, teamId)) {
            long used = submissionRepo.countByChallengeIdAndTeamId(challengeId, teamId);
            return CTFCompetitionSubmitResponse.builder()
                    .correct(false)
                    .message("Your team has already solved this challenge.")
                    .attemptsUsed((int) used)
                    .attemptsRemaining(remainingFor(challenge, used))
                    .build();
        }

        // Server-side attempt limit enforcement — counted per team, per challenge
        long userAttempts = submissionRepo.countByChallengeIdAndTeamId(challengeId, teamId);
        Integer maxAttempts = challenge.getMaxAttempts();
        if (maxAttempts != null && maxAttempts > 0 && userAttempts >= maxAttempts) {
            return CTFCompetitionSubmitResponse.builder()
                    .correct(false)
                    .message("Your team has no attempts remaining for this challenge.")
                    .attemptsUsed((int) userAttempts)
                    .attemptsRemaining(0)
                    .lockedOut(true)
                    .build();
        }

        String rateKey = teamId + ":" + challengeId;
        if (isRateLimited(rateKey)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many incorrect attempts. Please wait before trying again.");
        }

        // CHANGE 1: use MessageDigest.isEqual on SHA-256 digests — never String.equals().
        String submittedHash = sha256(req.getFlag().trim());

        String expectedHash;
        boolean isDynamic = challenge.getFlagType() == CTFChallenge.FlagType.DYNAMIC;
        if (isDynamic) {
            Optional<CTFTeamFlag> teamFlagOpt = flagRepo.findByCompetitionIdAndChallengeIdAndTeamId(
                    competitionId, challengeId, teamId);
            expectedHash = teamFlagOpt.map(CTFTeamFlag::getFlagHash).orElseGet(() -> {
                String h = teamService.computeTeamFlagHash(competitionId, challengeId, teamId);
                flagRepo.save(CTFTeamFlag.builder()
                        .competitionId(competitionId)
                        .challengeId(challengeId)
                        .teamId(teamId)
                        .flagHash(h)
                        .build());
                return h;
            });
        } else {
            expectedHash = challenge.getFlagHash();
        }

        // Timing-safe comparison on SHA-256 hex strings
        boolean correct = expectedHash != null && MessageDigest.isEqual(
                submittedHash.getBytes(StandardCharsets.UTF_8),
                expectedHash.getBytes(StandardCharsets.UTF_8));

        // Cross-team flag detection: the flag isn't this team's, but matches another
        // team's flag for the same challenge. Log it silently, then treat it as a
        // correct solve — the player must see nothing unusual; only the teacher
        // cheat tab reveals what happened.
        boolean cheat = false;
        if (!correct) {
            Optional<CTFTeamFlag> sourceFlag = flagRepo.findCheatSource(
                    competitionId, challengeId, submittedHash, teamId);
            if (sourceFlag.isPresent()) {
                cheat   = true;
                correct = true; // from here on, handled exactly like a real solve
                // Never log the flag string — it lives in the DB only.
                log.info("Cheat detected: team {} submitted team {} flag for challenge {}",
                        teamId, sourceFlag.get().getTeamId(), challengeId);
                cheatRepo.save(CTFCheatEvent.builder()
                        .competitionId(competitionId)
                        .challengeId(challengeId)
                        .submittingTeam(teamId)
                        .submittingUserId(userId)          // exact member, from the JWT
                        .sourceTeam(sourceFlag.get().getTeamId())
                        .submittedValue(req.getFlag().trim())
                        .build());
            }
        }

        // Persist every submission — correct, wrong, and cheat — for the audit trail.
        int attemptNumber = (int) userAttempts + 1;
        submissionRepo.save(CTFSubmission.builder()
                .competitionId(competitionId)
                .challengeId(challengeId)
                .teamId(teamId)
                .userId(userId)
                .submittedValue(req.getFlag().trim())
                .isCorrect(correct)
                .isCheatFlagged(cheat)
                .attemptNumber(attemptNumber)
                .ipAddress(ipAddress)
                .build());

        if (!correct) {
            recordWrongAttempt(rateKey);
            long usedNow = userAttempts + 1;
            Integer remaining = remainingFor(challenge, usedNow);
            return CTFCompetitionSubmitResponse.builder()
                    .correct(false)
                    .message("Incorrect flag.")
                    .attemptsUsed((int) usedNow)
                    .attemptsRemaining(remaining)
                    .lockedOut(remaining != null && remaining == 0)
                    .build();
        }

        int solveCount = solveRepo.countByCompetitionIdAndChallengeId(competitionId, challengeId);
        int points     = scoringEngine.challengeValue(comp, challenge, solveCount + 1);

        // Persist solve record (used for already-solved check and solve counts)
        CTFCompetitionSolve solve = CTFCompetitionSolve.builder()
                .competitionId(competitionId)
                .challengeId(challengeId)
                .teamId(teamId)
                .solvedBy(userId)
                .pointsAwarded(points)
                .build();
        solveRepo.save(solve);

        // Stop the team's running Docker instance for this challenge (if any).
        // Teardown runs after the solve is committed; failure never blocks the solve.
        boolean instanceStopped = instanceService.stopInstanceOnSolve(challengeId, teamId);

        // Insert positive award for the solving team.
        // Scoreboard reads from ctf_awards SUM — never a stored score column.
        String solveReason = "solve:" + challengeId;
        awardRepo.save(CTFAward.builder()
                .competitionId(competitionId)
                .teamId(teamId)
                .value(points)
                .reason(solveReason)
                .build());

        // ── Retroactive decay corrections ────────────────────────────────────────
        // For LINEAR / LOGARITHMIC scoring, every team that solved this challenge
        // must always hold the SAME current point value.  After this (solveCount+1)th
        // solve the challenge is worth `points`; previously it was worth
        // computePoints(..., solveCount).  Issue a correction award (negative delta)
        // to every team that already held a solve award so that their net contribution
        // from this challenge equals the new decayed value.
        CTFCompetition.ScoringFunction fn = comp.getScoringFunction();
        if (fn == null) fn = CTFCompetition.ScoringFunction.LOGARITHMIC;
        if (fn != CTFCompetition.ScoringFunction.STATIC && solveCount > 0) {
            int previousPoints = scoringEngine.challengeValue(comp, challenge, solveCount);
            int delta = points - previousPoints;
            if (delta != 0) {
                List<CTFAward> priorSolveAwards = awardRepo.findByCompetitionIdAndReason(competitionId, solveReason);
                Set<UUID> correctedTeams = new HashSet<>();
                for (CTFAward prior : priorSolveAwards) {
                    // Skip the team that just solved — they already receive the decayed value directly.
                    if (prior.getTeamId().equals(teamId)) continue;
                    if (correctedTeams.add(prior.getTeamId())) {
                        awardRepo.save(CTFAward.builder()
                                .competitionId(competitionId)
                                .teamId(prior.getTeamId())
                                .value(delta)
                                .reason("decay-correction:" + challengeId)
                                .build());
                    }
                }
            }
        }

        CTFTeam team = teamRepo.findById(teamId).orElseThrow();
        broadcastSolve(comp, team, challenge, points, now);

        List<CTFScoreboardEntryDTO> scoreboard = getScoreboard(competitionId);
        int newRank = scoreboard.stream()
                .filter(e -> e.getTeamId().equals(teamId))
                .findFirst()
                .map(CTFScoreboardEntryDTO::getRank)
                .orElse(0);

        long usedNow = userAttempts + 1;
        return CTFCompetitionSubmitResponse.builder()
                .correct(true)
                .message("Correct! +" + points + " points awarded to your team.")
                .pointsAwarded(points)
                .newRank(newRank)
                .attemptsUsed((int) usedNow)
                .attemptsRemaining(remainingFor(challenge, usedNow))
                .lockedOut(false)
                .instanceStopped(instanceStopped)
                .build();
    }

    // ── Attempt history ────────────────────────────────────────────────────────

    public List<CTFAttemptDTO> getMyAttempts(UUID competitionId, UUID challengeId, UUID userId) {
        CTFTeamMember membership = memberRepo.findByCompetitionIdAndUserId(competitionId, userId)
                .orElse(null);
        UUID teamId = membership != null ? membership.getId().getTeamId() : null;

        List<CTFSubmission> subs = teamId != null
                ? submissionRepo.findByChallengeIdAndTeamIdOrderBySubmittedAtDesc(
                        challengeId, teamId, PageRequest.of(0, 20))
                : List.of();

        return subs.stream().map(s -> CTFAttemptDTO.builder()
                .id(s.getId())
                .submittedAt(s.getSubmittedAt())
                .correct(Boolean.TRUE.equals(s.getIsCorrect()))
                .flagMasked(maskFlag(s.getSubmittedValue()))
                .attemptNumber(s.getAttemptNumber())
                .build()
        ).collect(Collectors.toList());
    }

    private static String maskFlag(String flag) {
        if (flag == null) return "";
        if (flag.length() <= 6) return "***";
        int keep = 3;
        return flag.substring(0, keep) + "***" + flag.substring(flag.length() - keep);
    }

    private static Integer remainingFor(CTFChallenge challenge, long usedNow) {
        Integer max = challenge.getMaxAttempts();
        if (max == null || max <= 0) return null; // unlimited
        return Math.max(0, max - (int) usedNow);
    }

    // ── WebSocket broadcast ────────────────────────────────────────────────────

    private void broadcastSolve(CTFCompetition comp, CTFTeam team, CTFChallenge challenge,
                                 int points, LocalDateTime solvedAt) {
        CTFFeedEventDTO feed = CTFFeedEventDTO.builder()
                .competitionId(comp.getId())
                .teamId(team.getId())
                .teamName(team.getName())
                .avatarColor(team.getAvatarColor())
                .challengeId(challenge.getId())
                .challengeTitle(challenge.getTitle())
                .pointsAwarded(points)
                .solvedAt(solvedAt)
                .build();

        feedCache.compute(comp.getId(), (k, deque) -> {
            if (deque == null) deque = new java.util.ArrayDeque<>();
            deque.addFirst(feed);
            while (deque.size() > FEED_MAX_SIZE) deque.removeLast();
            return deque;
        });

        ws.convertAndSend("/topic/ctf/competitions/" + comp.getId() + "/feed", feed);
        if (!Boolean.TRUE.equals(comp.getIsFrozen())) {
            ws.convertAndSend("/topic/ctf/competitions/" + comp.getId() + "/scoreboard",
                    getScoreboard(comp.getId()));
        }
    }

    /** Pushes a live scoreboard update to all connected clients, unless the board is frozen. */
    public void broadcastScoreboardIfUnfrozen(UUID competitionId) {
        CTFCompetition comp = requireCompetition(competitionId);
        if (!Boolean.TRUE.equals(comp.getIsFrozen())) {
            ws.convertAndSend(
                    "/topic/ctf/competitions/" + competitionId + "/scoreboard",
                    getScoreboard(competitionId));
        }
    }

    public void broadcastControlEvent(UUID competitionId, String event) {
        CTFCompetition comp = requireCompetition(competitionId);
        CTFCompetitionStatusDTO status = getStatus(competitionId, null);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", event);
        payload.put("status", status);
        ws.convertAndSend("/topic/ctf/" + competitionId + "/control", payload);
    }

    // ── Rate limiting ──────────────────────────────────────────────────────────

    private boolean isRateLimited(String key) {
        List<Long> attempts = wrongAttempts.getOrDefault(key, Collections.emptyList());
        long windowStart    = System.currentTimeMillis() - RATE_LIMIT_WINDOW;
        long recentCount    = attempts.stream().filter(t -> t > windowStart).count();
        return recentCount >= RATE_LIMIT_MAX;
    }

    private void recordWrongAttempt(String key) {
        wrongAttempts.compute(key, (k, list) -> {
            if (list == null) list = new ArrayList<>();
            list.add(System.currentTimeMillis());
            long windowStart = System.currentTimeMillis() - RATE_LIMIT_WINDOW;
            list.removeIf(t -> t <= windowStart);
            return list;
        });
    }

    // ── SHA-256 helper ─────────────────────────────────────────────────────────

    private String sha256(String input) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    // ── Challenge DTO builder ──────────────────────────────────────────────────

    /**
     * @param asOf            when non-null (frozen), use solve count up to that timestamp.
     * @param unlockedHintIds hint IDs this team has already unlocked — content is
     *                        withheld for all other hints so the answer never leaks.
     */
    private CTFChallengeDTO buildChallengeDTO(CTFChallenge c, boolean solved,
                                               CTFCompetition comp, LocalDateTime asOf,
                                               Set<String> unlockedHintIds) {
        int solveCount = (asOf != null)
                ? solveRepo.countByCompetitionIdAndChallengeIdAndSolvedAtLessThanEqual(comp.getId(), c.getId(), asOf)
                : solveRepo.countByCompetitionIdAndChallengeId(comp.getId(), c.getId());
        int currentPoints = scoringEngine.challengeValue(comp, c, solveCount);

        List<CTFHintDTO> hints = null;
        int myHintPenalty = 0;
        if (c.getHints() != null) {
            hints = c.getHints().stream()
                    .map(h -> {
                        boolean unlocked = unlockedHintIds.contains(h.id());
                        // Send text only if the team has unlocked this hint.
                        return new CTFHintDTO(h.id(), h.cost(), unlocked ? h.text() : null);
                    })
                    .collect(Collectors.toList());
            myHintPenalty = c.getHints().stream()
                    .filter(h -> unlockedHintIds.contains(h.id()))
                    .mapToInt(com.university.platform.ctf.dto.CTFHint::cost)
                    .sum();
        }

        return CTFChallengeDTO.builder()
                .id(c.getId())
                .title(c.getTitle())
                .description(c.getDescription())
                .category(c.getCategory().name())
                .difficulty(c.getDifficulty().name())
                .basePoints(c.getBasePoints())
                .currentPoints(currentPoints)
                .flagFormat(c.getFlagFormat())
                .flagType(c.getFlagType() != null ? c.getFlagType().name() : "STATIC")
                .requiresInstance(Boolean.TRUE.equals(c.getRequiresInstance()))
                .connectionType(c.getConnectionType())
                .downloadableFileUrl(c.getDownloadableFileUrl())
                .downloadableFileName(c.getDownloadableFileName())
                .mediaUrl(c.getMediaUrl())
                .hints(hints)
                .maxAttempts(c.getMaxAttempts())
                .isActive(Boolean.TRUE.equals(c.getIsActive()))
                .solveCount(solveCount)
                .solvedByMe(solved)
                .myHintPenalty(myHintPenalty)
                .build();
    }

    private CTFCompetition requireCompetition(UUID id) {
        return competitionRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found."));
    }
}
