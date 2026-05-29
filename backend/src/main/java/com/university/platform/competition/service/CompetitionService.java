package com.university.platform.competition.service;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.VisibilityMode;
import com.university.platform.audit.AuditDomain;
import com.university.platform.audit.AuditEventService;
import com.university.platform.audit.Severity;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.model.Problem.DifficultyLevel;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.assessment.repository.TestCaseRepository;
import com.university.platform.competition.dto.*;
import com.university.platform.assessment.model.TestCase;
import com.university.platform.competition.model.*;
import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.competition.model.CompetitionSubmission.Verdict;
import com.university.platform.competition.model.Team.TeamStatus;
import com.university.platform.competition.repository.*;
import com.university.platform.config.RabbitMQConfig;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import com.university.platform.execution.model.SubmissionJobMessage;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.TeacherRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitionService {

    private static final String INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int INVITE_CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CompetitionRepository competitionRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final CompetitionSubmissionRepository competitionSubmissionRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final SubmissionRepository submissionRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final ProblemRepository problemRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final TestCaseRepository testCaseRepository;
    private final CompetitionViolationRepository competitionViolationRepository;
    private final RabbitTemplate rabbitTemplate;
    private final AuditEventService auditEventService;

    // -------------------------------------------------------------------------
    // Create competition
    // -------------------------------------------------------------------------

    @Transactional
    public UUID createCompetition(CreateCompetitionRequest req, UUID creatorId) {
        if (req.getStartTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "startTime is required and could not be parsed. " +
                "Expected format: yyyy-MM-dd'T'HH:mm — example: 2026-04-28T10:00");
        }
        if (req.getStartTime().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startTime must be in the future");
        }
        if (req.getDurationMinutes() < 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationMinutes must be at least 30");
        }

        if (req.getMode() == CompetitionMode.TEAM) {
            if (req.getMaxTeamSize() < 2 || req.getMaxTeamSize() > 5) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "maxTeamSize must be between 2 and 5 for TEAM competitions");
            }
        }

        VisibilityMode visibility = req.getVisibilityMode() != null
                ? req.getVisibilityMode()
                : VisibilityMode.REQUEST_BASED;

        if (visibility == VisibilityMode.MODULE_ONLY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Competitions cannot be restricted to a single module.");
        }

        Competition competition = Competition.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .createdBy(creatorId)
                .startTime(req.getStartTime())
                .durationMinutes(req.getDurationMinutes())
                .mode(req.getMode() != null ? req.getMode() : CompetitionMode.SOLO)
                .maxTeamSize(req.getMode() == CompetitionMode.TEAM ? req.getMaxTeamSize() : 1)
                .status(CompetitionStatus.REGISTRATION)
                .isPublic(req.getIsPublic() != null ? req.getIsPublic() : true)
                .visibilityMode(visibility)
                .build();

        competitionRepository.save(competition);
        log.info("[COMPETITION] Created competition {} by user {}", competition.getCompetitionId(), creatorId);
        return competition.getCompetitionId();
    }

    // -------------------------------------------------------------------------
    // Publish (DRAFT → REGISTRATION)
    // -------------------------------------------------------------------------

    @Transactional
    public void publishCompetition(UUID competitionId, UUID requesterId) {
        Competition competition = requireCompetition(competitionId);
        requireCreator(competition, requesterId);

        if (competition.getStatus() != CompetitionStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only DRAFT competitions can be published");
        }
        if (competitionProblemRepository.countByCompetitionId(competitionId) == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot publish a competition with no problems");
        }

        competition.setStatus(CompetitionStatus.REGISTRATION);
        competitionRepository.save(competition);
        log.info("[COMPETITION] Competition {} → REGISTRATION", competitionId);
    }

    // -------------------------------------------------------------------------
    // Attach / detach problems
    // -------------------------------------------------------------------------

    @Transactional
    public int attachProblem(UUID competitionId, UUID problemId, AttachProblemRequest req, UUID requesterId) {
        Competition competition = requireCompetition(competitionId);
        requireCreator(competition, requesterId);

        if (competition.getStatus() == CompetitionStatus.ACTIVE || competition.getStatus() == CompetitionStatus.ENDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot attach problems after competition starts");
        }
        if (competitionProblemRepository.existsByCompetitionIdAndProblem_ProblemId(competitionId, problemId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Problem already attached");
        }

        Problem problem = problemRepository.findById(problemId)
                .orElseThrow(() -> new EntityNotFoundException("Problem not found: " + problemId));

        int points;
        if (req != null && req.getPoints() != null) {
            if (req.getPoints() < 100 || req.getPoints() > 3000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Points must be between 100 and 3000");
            }
            points = req.getPoints();
        } else {
            points = defaultPoints(problem.getDifficultyLevel());
        }

        int orderIndex = competitionProblemRepository.countByCompetitionId(competitionId);

        CompetitionProblem cp = CompetitionProblem.builder()
                .competitionId(competitionId)
                .problem(problem)
                .orderIndex(orderIndex)
                .points(points)
                .build();

        competitionProblemRepository.save(cp);
        log.info("[COMPETITION] Attached problem {} to competition {} (order={}, points={})",
                problemId, competitionId, orderIndex, points);
        return points;
    }

    @Transactional
    public void detachProblem(UUID competitionId, UUID problemId, UUID requesterId) {
        Competition competition = requireCompetition(competitionId);
        requireCreator(competition, requesterId);

        if (competition.getStatus() != CompetitionStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Can only remove problems when competition is in DRAFT status");
        }
        if (!competitionProblemRepository.existsByCompetitionIdAndProblem_ProblemId(competitionId, problemId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not attached to this competition");
        }

        competitionProblemRepository.deleteByCompetitionIdAndProblem_ProblemId(competitionId, problemId);

        // Re-index remaining problems to fill gap
        List<CompetitionProblem> remaining =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setOrderIndex(i);
        }
        competitionProblemRepository.saveAll(remaining);
        log.info("[COMPETITION] Detached problem {} from competition {}", problemId, competitionId);
    }

    // -------------------------------------------------------------------------
    // List / get
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CompetitionSummaryDTO> listCompetitions(CompetitionStatus statusFilter,
                                                         UUID studentId,
                                                         boolean includeTeacherData) {
        List<Competition> competitions = statusFilter != null
                ? competitionRepository.findByStatus(statusFilter)
                : competitionRepository.findAll();

        // Batch pending count — single query
        Map<UUID, Long> pendingCountMap = Collections.emptyMap();
        if (includeTeacherData) {
            List<UUID> requestBasedIds = competitions.stream()
                    .filter(c -> c.getVisibilityMode() == VisibilityMode.REQUEST_BASED)
                    .map(Competition::getCompetitionId)
                    .toList();
            if (!requestBasedIds.isEmpty()) {
                pendingCountMap = joinRequestRepository
                        .countGroupedByCompetitionId(requestBasedIds, JoinRequestStatus.PENDING)
                        .stream()
                        .collect(java.util.stream.Collectors.toMap(
                                row -> (UUID) row[0],
                                row -> (Long) row[1]));
            }
        }
        final Map<UUID, Long> pendingCounts = pendingCountMap;

        // Batch-load creator names
        List<UUID> creatorIds = competitions.stream()
                .map(Competition::getCreatedBy).filter(Objects::nonNull).distinct().toList();
        Map<UUID, String> creatorNames = teacherRepository.findAllById(creatorIds).stream()
                .collect(Collectors.toMap(
                        Teacher::getId,
                        t -> t.getFirstName() + " " + t.getLastName()));

        return competitions.stream().map(c -> {
            int problemCount = competitionProblemRepository.countByCompetitionId(c.getCompetitionId());
            int participantCount = c.getMode() == CompetitionMode.SOLO
                    ? competitionRegistrationRepository.countByCompetitionId(c.getCompetitionId())
                    : teamRepository.findByCompetitionId(c.getCompetitionId()).size();

            String creatorName = c.getCreatedBy() != null
                    ? creatorNames.getOrDefault(c.getCreatedBy(), "Unknown")
                    : "Unknown";

            String myJoinStatus = null;
            UUID myTeamId = null;
            if (studentId != null) {
                if (c.getVisibilityMode() == VisibilityMode.REQUEST_BASED) {
                    myJoinStatus = joinRequestRepository
                            .findByCompetitionIdAndStudentId(c.getCompetitionId(), studentId)
                            .map(jr -> jr.getStatus().name())
                            .orElse("NOT_REQUESTED");
                } else {
                    boolean registered = competitionRegistrationRepository
                            .existsByCompetitionIdAndStudentId(c.getCompetitionId(), studentId);
                    myJoinStatus = registered ? "APPROVED" : "NOT_REQUESTED";
                }
                if (c.getMode() == CompetitionMode.TEAM) {
                    myTeamId = teamMemberRepository
                            .findTeamIdByCompetitionIdAndStudentId(c.getCompetitionId(), studentId)
                            .orElse(null);
                }
            }

            Integer pendingRequestCount = null;
            if (includeTeacherData && c.getVisibilityMode() == VisibilityMode.REQUEST_BASED) {
                pendingRequestCount = pendingCounts
                        .getOrDefault(c.getCompetitionId(), 0L).intValue();
            }

            return CompetitionSummaryDTO.builder()
                    .competitionId(c.getCompetitionId())
                    .title(c.getTitle())
                    .creatorName(creatorName)
                    .mode(c.getMode())
                    .status(c.getStatus())
                    .startTime(c.getStartTime())
                    .durationMinutes(c.getDurationMinutes())
                    .problemCount(problemCount)
                    .participantCount(participantCount)
                    .registeredCount(participantCount)
                    .minTeamSize(c.getMode() == CompetitionMode.TEAM ? c.getMinTeamSize() : null)
                    .maxTeamSize(c.getMode() == CompetitionMode.TEAM ? c.getMaxTeamSize() : null)
                    .visibilityMode(c.getVisibilityMode())
                    .myJoinStatus(myJoinStatus)
                    .myTeamId(myTeamId)
                    .pendingRequestCount(pendingRequestCount)
                    .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public CompetitionDetailDTO getDetail(UUID competitionId) {
        Competition competition = requireCompetition(competitionId);
        List<CompetitionProblem> cps =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);

        List<CompetitionDetailDTO.ProblemEntry> problemEntries = cps.stream()
                .map(cp -> CompetitionDetailDTO.ProblemEntry.builder()
                        .problemId(cp.getProblem().getProblemId())
                        .label(String.valueOf((char) ('A' + cp.getOrderIndex())))
                        .title(cp.getProblem().getTitle())
                        .difficultyLevel(cp.getProblem().getDifficultyLevel().name())
                        .points(cp.getPoints())
                        .timeLimitMs(cp.getProblem().getTimeLimitMs())
                        .memoryLimitMb(cp.getProblem().getMemoryLimitMb())
                        .build())
                .toList();

        return CompetitionDetailDTO.builder()
                .competitionId(competition.getCompetitionId())
                .title(competition.getTitle())
                .description(competition.getDescription())
                .mode(competition.getMode())
                .minTeamSize(competition.getMinTeamSize())
                .maxTeamSize(competition.getMaxTeamSize())
                .status(competition.getStatus())
                .startTime(competition.getStartTime())
                .durationMinutes(competition.getDurationMinutes())
                .isPublic(competition.isPublic())
                .visibilityMode(competition.getVisibilityMode())
                .penaltyEnabled(competition.isPenaltyEnabled())
                .penaltyMinutes(competition.getPenaltyMinutes())
                .problems(problemEntries)
                .build();
    }

    // -------------------------------------------------------------------------
    // Solo registration
    // -------------------------------------------------------------------------

    @Transactional
    public void register(UUID competitionId, UUID studentId) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getMode() != CompetitionMode.SOLO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Use team endpoints for TEAM competitions");
        }
        if (competition.getStatus() != CompetitionStatus.REGISTRATION
                && competition.getStatus() != CompetitionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Registration is not open for this competition");
        }
        if (competitionRegistrationRepository.existsByCompetitionIdAndStudentId(competitionId, studentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already registered");
        }

        CompetitionRegistration reg = CompetitionRegistration.builder()
                .competitionId(competitionId)
                .studentId(studentId)
                .build();
        competitionRegistrationRepository.save(reg);
        log.info("[COMPETITION] Student {} registered for solo competition {}", studentId, competitionId);
    }

    // -------------------------------------------------------------------------
    // Team management
    // -------------------------------------------------------------------------

    @Transactional
    public Map<String, Object> createTeam(UUID competitionId, UUID studentId, CreateTeamRequest req) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getMode() != CompetitionMode.TEAM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This is not a TEAM competition");
        }
        if (competition.getStatus() != CompetitionStatus.REGISTRATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Team creation is only allowed during REGISTRATION phase");
        }
        if (teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You are already in a team for this competition");
        }

        String inviteCode = generateUniqueInviteCode(competitionId);

        Team team = Team.builder()
                .competitionId(competitionId)
                .name(req.getTeamName())
                .inviteCode(inviteCode)
                .captainId(studentId)
                .status(TeamStatus.FORMING)
                .build();
        teamRepository.save(team);

        TeamMember captain = TeamMember.builder()
                .teamId(team.getTeamId())
                .studentId(studentId)
                .build();
        teamMemberRepository.save(captain);

        log.info("[COMPETITION] Team '{}' created in competition {} by student {}, inviteCode={}",
                team.getName(), competitionId, studentId, inviteCode);

        return Map.of("message", "Team created", "teamId", team.getTeamId(), "inviteCode", inviteCode);
    }

    @Transactional
    public Map<String, Object> joinTeam(UUID competitionId, UUID studentId, JoinTeamRequest req) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getMode() != CompetitionMode.TEAM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This is not a TEAM competition");
        }
        if (competition.getStatus() != CompetitionStatus.REGISTRATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot join a team after competition has started");
        }
        if (teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You are already in a team for this competition");
        }

        Team team = teamRepository.findByCompetitionIdAndInviteCode(competitionId, req.getInviteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid invite code"));

        if (team.getStatus() != TeamStatus.FORMING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team is locked");
        }
        if (teamMemberRepository.countByTeamId(team.getTeamId()) >= competition.getMaxTeamSize()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team is full");
        }

        TeamMember member = TeamMember.builder()
                .teamId(team.getTeamId())
                .studentId(studentId)
                .build();
        teamMemberRepository.save(member);

        log.info("[COMPETITION] Student {} joined team {} in competition {}", studentId, team.getTeamId(), competitionId);
        return Map.of("message", "Joined team", "teamId", team.getTeamId(), "teamName", team.getName());
    }

    @Transactional(readOnly = true)
    public TeamDetailDTO getTeamDetail(UUID competitionId, UUID teamId) {
        requireCompetition(competitionId);
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new EntityNotFoundException("Team not found: " + teamId));
        if (!team.getCompetitionId().equals(competitionId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not in this competition");
        }

        Competition competition = requireCompetition(competitionId);
        List<TeamMember> members = teamMemberRepository.findByTeamId(teamId);

        List<UUID> studentIds = members.stream().map(TeamMember::getStudentId).toList();
        Map<UUID, Student> studentMap = studentRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        List<TeamDetailDTO.MemberEntry> memberEntries = members.stream()
                .map(m -> {
                    Student s = studentMap.get(m.getStudentId());
                    return TeamDetailDTO.MemberEntry.builder()
                            .studentId(m.getStudentId())
                            .firstName(s != null ? s.getFirstName() : "")
                            .lastName(s != null ? s.getLastName() : "")
                            .joinedAt(m.getJoinedAt())
                            .build();
                }).toList();

        return TeamDetailDTO.builder()
                .teamId(teamId)
                .teamName(team.getName())
                .inviteCode(team.getInviteCode())
                .captainId(team.getCaptainId())
                .status(team.getStatus())
                .members(memberEntries)
                .currentSize(members.size())
                .maxSize(competition.getMaxTeamSize())
                .build();
    }

    @Transactional
    public void leaveTeam(UUID competitionId, UUID studentId) {
        Competition competition = requireCompetition(competitionId);
        if (competition.getStatus() != CompetitionStatus.REGISTRATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot leave a team after the competition has started");
        }
        TeamMember member = teamMemberRepository.findByCompetitionIdAndStudentId(competitionId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "You are not in a team"));

        UUID teamId = member.getTeamId();
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new EntityNotFoundException("Team not found"));

        teamMemberRepository.delete(member);

        List<TeamMember> remaining = teamMemberRepository.findByTeamId(teamId);
        if (remaining.isEmpty()) {
            teamRepository.delete(team);
        } else if (team.getCaptainId().equals(studentId)) {
            team.setCaptainId(remaining.get(0).getStudentId());
            teamRepository.save(team);
        }
        log.info("[COMPETITION] Student {} left team {} in competition {}", studentId, teamId, competitionId);
    }

    @Transactional(readOnly = true)
    public TeamDetailDTO getMyTeam(UUID competitionId, UUID studentId) {
        requireCompetition(competitionId);
        UUID teamId = teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No team found"));
        return getTeamDetail(competitionId, teamId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLobby(UUID competitionId, UUID studentId) {
        Competition competition = requireCompetition(competitionId);
        log.info("[LOBBY] studentId={} accessed competitionId={}", studentId, competitionId);

        long secondsUntilStart = 0;
        if (competition.getStartTime() != null) {
            secondsUntilStart = Math.max(0,
                    ChronoUnit.SECONDS.between(LocalDateTime.now(), competition.getStartTime()));
        }

        List<CompetitionProblem> cps =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);
        List<Map<String, Object>> problemPreviews = cps.stream().map(cp -> {
            Map<String, Object> p = new HashMap<>();
            p.put("label", String.valueOf((char) ('A' + cp.getOrderIndex())));
            p.put("difficultyLevel", cp.getProblem().getDifficultyLevel().name());
            p.put("points", cp.getPoints());
            return p;
        }).toList();

        List<Map<String, Object>> teamSummaries = List.of();
        TeamDetailDTO myTeam = null;

        if (competition.getMode() == CompetitionMode.TEAM) {
            UUID myTeamId = teamMemberRepository
                    .findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).orElse(null);
            teamSummaries = teamRepository.findByCompetitionId(competitionId).stream().map(t -> {
                Map<String, Object> ts = new HashMap<>();
                ts.put("teamId", t.getTeamId());
                ts.put("teamName", t.getName());
                ts.put("memberCount", teamMemberRepository.countByTeamId(t.getTeamId()));
                ts.put("isMyTeam", t.getTeamId().equals(myTeamId));
                return ts;
            }).toList();
            if (myTeamId != null) {
                myTeam = getTeamDetail(competitionId, myTeamId);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("competitionId", competition.getCompetitionId());
        result.put("title", competition.getTitle());
        result.put("description", competition.getDescription());
        result.put("mode", competition.getMode().name());
        result.put("status", competition.getStatus().name());
        result.put("startTime", competition.getStartTime());
        result.put("durationMinutes", competition.getDurationMinutes());
        result.put("minTeamSize", competition.getMinTeamSize());
        result.put("maxTeamSize", competition.getMaxTeamSize());
        result.put("penaltyEnabled", competition.isPenaltyEnabled());
        result.put("penaltyMinutes", competition.getPenaltyMinutes());
        result.put("secondsUntilStart", secondsUntilStart);
        result.put("isLive", competition.getStatus() == CompetitionStatus.ACTIVE);
        result.put("problems", problemPreviews);
        result.put("teams", teamSummaries);
        result.put("myTeam", myTeam);
        result.put("registeredCount", competitionRegistrationRepository.countByCompetitionId(competitionId));
        return result;
    }

    // -------------------------------------------------------------------------
    // Submit
    // -------------------------------------------------------------------------

    @Transactional
    public UUID submit(UUID competitionId, UUID studentId, CompetitionSubmitRequest req) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getStatus() != CompetitionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Competition is not active (status=" + competition.getStatus() + ")");
        }

        // For REQUEST_BASED competitions, verify approved join request before registration check
        if (competition.getVisibilityMode() == VisibilityMode.REQUEST_BASED) {
            JoinRequest jr = joinRequestRepository
                    .findByCompetitionIdAndStudentId(competitionId, studentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "You do not have an approved request to participate in this competition."));
            if (jr.getStatus() != JoinRequestStatus.APPROVED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Your participation request has not been approved yet.");
            }
        }

        // Validate participant
        if (competition.getMode() == CompetitionMode.SOLO) {
            if (!competitionRegistrationRepository.existsByCompetitionIdAndStudentId(competitionId, studentId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You are not registered for this competition");
            }
        } else {
            if (teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You are not in a team for this competition");
            }
        }

        // Validate problem belongs to this competition
        if (!competitionProblemRepository.existsByCompetitionIdAndProblem_ProblemId(competitionId, req.getProblemId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Problem does not belong to this competition");
        }

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new EntityNotFoundException("Student not found: " + studentId));
        Problem problem = problemRepository.findById(req.getProblemId())
                .orElseThrow(() -> new EntityNotFoundException("Problem not found: " + req.getProblemId()));

        Submission submission = Submission.builder()
                .sourceCode(req.getSourceCode())
                .language(req.getLanguage())
                .timestamp(LocalDateTime.now())
                .attemptNumber(1)
                .status(SubmissionStatus.PENDING)
                .student(student)
                .problem(problem)
                .competitionId(competitionId)
                .planningMode(false)
                .build();

        submission = submissionRepository.save(submission);

        SubmissionJobMessage message = SubmissionJobMessage.builder()
                .submissionId(submission.getSubmissionId())
                .problemId(problem.getProblemId())
                .studentId(student.getId())
                .sourceCode(req.getSourceCode())
                .language(req.getLanguage())
                .timeLimitMs(problem.getTimeLimitMs())
                .memoryLimitMb(problem.getMemoryLimitMb())
                .runOnly(false)
                .build();

        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, message);
        log.info("[COMPETITION] Submission {} queued for competition {} student {} problem {}",
                submission.getSubmissionId(), competitionId, studentId, req.getProblemId());

        return submission.getSubmissionId();
    }

    // -------------------------------------------------------------------------
    // Arena
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ArenaDTO getArena(UUID competitionId, UUID studentId) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getStatus() != CompetitionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Competition is not active (status=" + competition.getStatus() + ")");
        }

        UUID myTeamId = null;
        if (competition.getMode() == CompetitionMode.SOLO) {
            if (!competitionRegistrationRepository.existsByCompetitionIdAndStudentId(competitionId, studentId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You are not registered for this competition");
            }
        } else {
            myTeamId = teamMemberRepository.findTeamIdByCompetitionIdAndStudentId(competitionId, studentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "You are not in a team for this competition"));
        }

        LocalDateTime endTime = competition.getStartTime().plusMinutes(competition.getDurationMinutes());
        long remainingSeconds = Math.max(0, ChronoUnit.SECONDS.between(LocalDateTime.now(), endTime));

        List<CompetitionProblem> cps =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);

        final UUID finalTeamId = myTeamId;
        List<ArenaDTO.ArenaProblemDTO> problems = new ArrayList<>();

        for (CompetitionProblem cp : cps) {
            UUID problemId = cp.getProblem().getProblemId();

            List<TestCase> testCases = testCaseRepository.findByProblem_ProblemId(problemId);
            List<ArenaDTO.VisibleTestCaseDTO> visibleTcs = testCases.stream()
                    .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                    .map(tc -> ArenaDTO.VisibleTestCaseDTO.builder()
                            .testCaseId(tc.getTestCaseId())
                            .input(tc.getInputData())
                            .expectedOutput(tc.getExpectedOutput())
                            .build())
                    .toList();
            int hiddenCount = (int) testCases.stream()
                    .filter(tc -> Boolean.TRUE.equals(tc.getIsHidden())).count();

            boolean solved;
            int attempts;
            if (competition.getMode() == CompetitionMode.SOLO) {
                solved = competitionSubmissionRepository.existsByCompetitionIdAndStudentIdAndProblemIdAndVerdict(
                        competitionId, studentId, problemId, Verdict.AC);
                attempts = competitionSubmissionRepository.countByCompetitionIdAndStudentIdAndProblemId(
                        competitionId, studentId, problemId);
            } else {
                solved = finalTeamId != null &&
                        competitionSubmissionRepository.existsByCompetitionIdAndTeamIdAndProblemIdAndVerdict(
                                competitionId, finalTeamId, problemId, Verdict.AC);
                attempts = finalTeamId != null
                        ? competitionSubmissionRepository.countByCompetitionIdAndTeamIdAndProblemId(
                                competitionId, finalTeamId, problemId)
                        : 0;
            }

            String solveStatus = solved ? "SOLVED" : (attempts > 0 ? "ATTEMPTED" : "UNSOLVED");

            problems.add(ArenaDTO.ArenaProblemDTO.builder()
                    .problemId(problemId)
                    .label(String.valueOf((char) ('A' + cp.getOrderIndex())))
                    .title(cp.getProblem().getTitle())
                    .description(cp.getProblem().getDescription())
                    .difficultyLevel(cp.getProblem().getDifficultyLevel().name())
                    .points(cp.getPoints())
                    .timeLimitMs(cp.getProblem().getTimeLimitMs())
                    .memoryLimitMb(cp.getProblem().getMemoryLimitMb())
                    .visibleTestCases(visibleTcs)
                    .hiddenTestCaseCount(hiddenCount)
                    .solveStatus(solveStatus)
                    .attempts(attempts)
                    .build());
        }

        TeamDetailDTO myTeam = null;
        if (competition.getMode() == CompetitionMode.TEAM && myTeamId != null) {
            myTeam = getTeamDetail(competitionId, myTeamId);
        }

        return ArenaDTO.builder()
                .competitionId(competitionId)
                .title(competition.getTitle())
                .mode(competition.getMode())
                .endTime(endTime)
                .remainingSeconds(remainingSeconds)
                .penaltyEnabled(competition.isPenaltyEnabled())
                .penaltyMinutes(competition.getPenaltyMinutes())
                .problems(problems)
                .myTeam(myTeam)
                .build();
    }

    // -------------------------------------------------------------------------
    // Team Activity
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTeamActivity(UUID competitionId, UUID studentId, int limit) {
        Competition competition = requireCompetition(competitionId);

        if (competition.getMode() != CompetitionMode.TEAM) {
            return List.of();
        }

        UUID teamId = teamMemberRepository
                .findTeamIdByCompetitionIdAndStudentId(competitionId, studentId)
                .orElse(null);
        if (teamId == null) return List.of();

        List<CompetitionProblem> cps =
                competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(competitionId);
        Map<UUID, String> problemLabels = cps.stream()
                .collect(Collectors.toMap(
                        cp -> cp.getProblem().getProblemId(),
                        cp -> String.valueOf((char) ('A' + cp.getOrderIndex()))));

        List<TeamMember> members = teamMemberRepository.findByTeamId(teamId);
        Set<UUID> memberIds = members.stream().map(TeamMember::getStudentId).collect(Collectors.toSet());

        Map<UUID, Student> studentMap = studentRepository.findAllById(memberIds).stream()
                .collect(Collectors.toMap(Student::getId, s -> s));

        List<CompetitionSubmission> recentSubs =
                competitionSubmissionRepository.findByCompetitionId(competitionId).stream()
                        .filter(s -> memberIds.contains(s.getStudentId()))
                        .sorted(Comparator.comparing(CompetitionSubmission::getSubmittedAt).reversed())
                        .limit(limit)
                        .toList();

        return recentSubs.stream().map(sub -> {
            Map<String, Object> entry = new HashMap<>();
            Student s = studentMap.get(sub.getStudentId());
            entry.put("studentId", sub.getStudentId());
            entry.put("studentName", s != null ? s.getFirstName() + " " + s.getLastName() : "Unknown");
            entry.put("problemLabel", problemLabels.getOrDefault(sub.getProblemId(), "?"));
            entry.put("verdict", sub.getVerdict().name());
            entry.put("score", sub.getScore());
            entry.put("submittedAt", sub.getSubmittedAt());
            return entry;
        }).toList();
    }

    // -------------------------------------------------------------------------
    // Violations
    // -------------------------------------------------------------------------

    @Transactional
    public void recordViolation(UUID competitionId, UUID studentId, ViolationReportDTO req) {
        log.warn("[VIOLATION] competitionId={} studentId={} type={} details={}",
                competitionId, studentId, req.type(), req.details());

        CompetitionViolation violation = CompetitionViolation.builder()
                .competitionId(competitionId)
                .studentId(studentId)
                .violationType(req.type())
                .details(req.details())
                .build();
        competitionViolationRepository.save(violation);

        Map<String, Object> detail = new HashMap<>();
        if (req.details() != null) detail.put("details", req.details());
        auditEventService.record(
                AuditDomain.CP,
                req.type(),
                competitionId,
                null,
                studentId,
                null,
                null,
                detail,
                Severity.WARN);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Competition requireCompetition(UUID competitionId) {
        return competitionRepository.findById(competitionId)
                .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + competitionId));
    }

    private void requireCreator(Competition competition, UUID requesterId) {
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the creator can manage this competition");
        }
    }

    private int defaultPoints(DifficultyLevel difficulty) {
        return switch (difficulty) {
            case EASY   -> 500;
            case MEDIUM -> 1000;
            case HARD   -> 1500;
        };
    }

    private String generateUniqueInviteCode(UUID competitionId) {
        String code;
        int tries = 0;
        do {
            if (++tries > 20) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Could not generate unique invite code");
            }
            StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                sb.append(INVITE_CODE_CHARS.charAt(RANDOM.nextInt(INVITE_CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (teamRepository.existsByCompetitionIdAndInviteCode(competitionId, code));
        return code;
    }
}
