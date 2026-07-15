package com.university.platform.competition.controller;

import com.university.platform.competition.dto.*;
import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.competition.model.CompetitionProblem;
import com.university.platform.competition.repository.CompetitionProblemRepository;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.competition.repository.CompetitionSubmissionRepository;
import com.university.platform.competition.repository.TeamRepository;
import com.university.platform.competition.service.CompetitionService;
import com.university.platform.competition.service.ScoreboardService;
import com.university.platform.identity.service.JwtService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
public class CompetitionController {

    private final CompetitionService competitionService;
    private final ScoreboardService scoreboardService;
    private final CompetitionRepository competitionRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final CompetitionSubmissionRepository competitionSubmissionRepository;
    private final TeamRepository teamRepository;
    private final JwtService jwtService;

    // -------------------------------------------------------------------------
    // POST /api/competitions  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PostMapping
    public ResponseEntity<?> createCompetition(
            @RequestBody CreateCompetitionRequest req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID creatorId = UUID.fromString(claims.getSubject());

        UUID competitionId = competitionService.createCompetition(req, creatorId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Competition created", "competitionId", competitionId));
    }

    // -------------------------------------------------------------------------
    // PUT /api/competitions/{id}/publish  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PutMapping("/{id}/publish")
    public ResponseEntity<?> publishCompetition(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        competitionService.publishCompetition(id, requesterId);
        return ResponseEntity.ok(Map.of("message", "Competition published (status=REGISTRATION)"));
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/problems/{problemId}  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/problems/{problemId}")
    public ResponseEntity<?> attachProblem(
            @PathVariable UUID id,
            @PathVariable UUID problemId,
            @RequestBody(required = false) AttachProblemRequest req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        int assignedPoints = competitionService.attachProblem(id, problemId, req, requesterId);
        return ResponseEntity.ok(Map.of("message", "Problem attached", "assignedPoints", assignedPoints));
    }

    // -------------------------------------------------------------------------
    // DELETE /api/competitions/{id}/problems/{problemId}  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @DeleteMapping("/{id}/problems/{problemId}")
    public ResponseEntity<?> detachProblem(
            @PathVariable UUID id,
            @PathVariable UUID problemId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        competitionService.detachProblem(id, problemId, requesterId);
        return ResponseEntity.ok(Map.of("message", "Problem removed from competition"));
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions  (any authenticated)
    // -------------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<List<CompetitionSummaryDTO>> listCompetitions(
            @RequestParam(required = false) String status,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        String role = claims.get("role", String.class);
        UUID studentId = "STUDENT".equals(role)
                ? UUID.fromString(claims.getSubject())
                : null;

        CompetitionStatus statusFilter = null;
        if (status != null && !status.isBlank()) {
            try {
                statusFilter = CompetitionStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
            }
        }

        boolean includeTeacherData = "TEACHER".equals(role) || "ADMIN".equals(role);
        UUID teacherId = "TEACHER".equals(role) ? UUID.fromString(claims.getSubject()) : null;
        return ResponseEntity.ok(competitionService.listCompetitions(statusFilter, studentId, includeTeacherData, teacherId));
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}  (any authenticated)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}")
    public ResponseEntity<CompetitionDetailDTO> getCompetition(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        parseClaims(auth);
        return ResponseEntity.ok(competitionService.getDetail(id));
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/register  (STUDENT)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/register")
    public ResponseEntity<?> register(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        competitionService.register(id, studentId);
        return ResponseEntity.ok(Map.of("message", "Registered for competition"));
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/teams  (STUDENT)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/teams")
    public ResponseEntity<?> createTeam(
            @PathVariable UUID id,
            @RequestBody CreateTeamRequest req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        Map<String, Object> result = competitionService.createTeam(id, studentId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/teams/join  (STUDENT)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/teams/join")
    public ResponseEntity<?> joinTeam(
            @PathVariable UUID id,
            @RequestBody JoinTeamRequest req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        Map<String, Object> result = competitionService.joinTeam(id, studentId, req);
        return ResponseEntity.ok(result);
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/teams/{teamId}  (any authenticated)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/teams/{teamId}")
    public ResponseEntity<TeamDetailDTO> getTeam(
            @PathVariable UUID id,
            @PathVariable UUID teamId,
            @RequestHeader("Authorization") String auth) {

        parseClaims(auth);
        return ResponseEntity.ok(competitionService.getTeamDetail(id, teamId));
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/lobby  (STUDENT)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/lobby")
    public ResponseEntity<?> getLobby(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        UUID studentId = UUID.fromString(claims.getSubject());
        return ResponseEntity.ok(competitionService.getLobby(id, studentId));
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/my-team  (STUDENT)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/my-team")
    public ResponseEntity<?> getMyTeam(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        try {
            return ResponseEntity.ok(competitionService.getMyTeam(id, studentId));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            if (e.getStatusCode().value() == 404) return ResponseEntity.notFound().build();
            throw e;
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /api/competitions/{id}/teams/leave  (STUDENT)
    // -------------------------------------------------------------------------

    @DeleteMapping("/{id}/teams/leave")
    public ResponseEntity<?> leaveTeam(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        competitionService.leaveTeam(id, studentId);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/scoreboard  (any authenticated)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/scoreboard")
    public ResponseEntity<?> getScoreboard(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        parseClaims(auth);
        List<?> scoreboard = scoreboardService.getScoreboard(id);
        return ResponseEntity.ok(scoreboard);
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/scoreboard/full  (mode-aware; freeze applies
    // to students, teachers/admins always see live standings)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/scoreboard/full")
    public ResponseEntity<?> getFullScoreboard(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        String role = claims.get("role", String.class);
        boolean isTeacher = "TEACHER".equals(role) || "ADMIN".equals(role);
        return ResponseEntity.ok(scoreboardService.getFullScoreboard(id, isTeacher));
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/violations  (STUDENT)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/violations")
    public ResponseEntity<Void> reportViolation(
            @PathVariable UUID id,
            @RequestBody ViolationReportDTO req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        competitionService.recordViolation(id, studentId, req);
        return ResponseEntity.ok().build();
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/arena  (STUDENT)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/arena")
    public ResponseEntity<ArenaDTO> getArena(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        return ResponseEntity.ok(competitionService.getArena(id, studentId));
    }

    // -------------------------------------------------------------------------
    // GET /api/competitions/{id}/team-activity  (STUDENT)
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/team-activity")
    public ResponseEntity<?> getTeamActivity(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "20") int limit,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        return ResponseEntity.ok(competitionService.getTeamActivity(id, studentId, limit));
    }

    // -------------------------------------------------------------------------
    // POST /api/competitions/{id}/submit  (STUDENT)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(
            @PathVariable UUID id,
            @RequestBody CompetitionSubmitRequest req,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        UUID submissionId = competitionService.submit(id, studentId, req);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                "submissionId", submissionId,
                "message", "Submission queued. Connect to /topic/submissions/" + submissionId + " for results."
        ));
    }

    // -------------------------------------------------------------------------
    // PUT /api/competitions/{id}/problems/reorder  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PutMapping("/{id}/problems/reorder")
    @Transactional
    public ResponseEntity<?> reorderProblems(
            @PathVariable UUID id,
            @RequestBody Map<String, List<UUID>> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can reorder problems");
        }

        List<UUID> problemIds = body.get("problemIds");
        if (problemIds == null) return ResponseEntity.badRequest().body(Map.of("error", "problemIds required"));

        List<CompetitionProblem> cps = competitionProblemRepository.findByCompetitionIdOrderByOrderIndexAsc(id);
        for (int i = 0; i < problemIds.size(); i++) {
            final int idx = i;
            final UUID pid = problemIds.get(i);
            cps.stream()
               .filter(cp -> cp.getProblem().getProblemId().equals(pid))
               .findFirst()
               .ifPresent(cp -> cp.setOrderIndex(idx));
        }
        competitionProblemRepository.saveAll(cps);
        return ResponseEntity.ok(Map.of("message", "Problems reordered"));
    }

    // -------------------------------------------------------------------------
    // PATCH /api/competitions/{id}/problems/{problemId}  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PatchMapping("/{id}/problems/{problemId}")
    @Transactional
    public ResponseEntity<?> updateProblemSettings(
            @PathVariable UUID id,
            @PathVariable UUID problemId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");

        CompetitionProblem cp = competitionProblemRepository
                .findByCompetitionIdAndProblem_ProblemId(id, problemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not in competition"));

        if (body.containsKey("maxPoints")) cp.setPoints(((Number) body.get("maxPoints")).intValue());
        competitionProblemRepository.save(cp);
        return ResponseEntity.ok(Map.of("message", "Problem settings updated"));
    }

    // -------------------------------------------------------------------------
    // PATCH /api/competitions/{id}/penalty  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PatchMapping("/{id}/penalty")
    public ResponseEntity<?> updatePenalty(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can change penalty settings");
        }

        if (body.containsKey("penaltyEnabled")) competition.setPenaltyEnabled((Boolean) body.get("penaltyEnabled"));
        if (body.containsKey("penaltyMinutes")) competition.setPenaltyMinutes(((Number) body.get("penaltyMinutes")).intValue());
        competitionRepository.save(competition);
        return ResponseEntity.ok(Map.of("message", "Penalty settings updated"));
    }

    // -------------------------------------------------------------------------
    // PATCH /api/competitions/{id}/settings  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PatchMapping("/{id}/settings")
    public ResponseEntity<?> updateSettings(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can edit settings");
        }
        if (competition.getStatus() == CompetitionStatus.ENDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot edit an ended competition");
        }

        if (body.containsKey("title")) competition.setTitle((String) body.get("title"));
        if (body.containsKey("description")) competition.setDescription((String) body.get("description"));
        if (body.containsKey("durationMinutes")) competition.setDurationMinutes(((Number) body.get("durationMinutes")).intValue());
        competitionRepository.save(competition);
        return ResponseEntity.ok(Map.of("message", "Settings saved"));
    }

    // -------------------------------------------------------------------------
    // Lifecycle: start / end  (TEACHER | ADMIN)
    // -------------------------------------------------------------------------

    @PostMapping("/{id}/start")
    public ResponseEntity<?> startCompetition(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can start a competition");
        }
        if (competition.getStatus() != CompetitionStatus.REGISTRATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Competition must be in REGISTRATION state to start (current: " + competition.getStatus() + ")");
        }
        competition.setStatus(CompetitionStatus.ACTIVE);
        competitionRepository.save(competition);
        return ResponseEntity.ok(Map.of("message", "Competition started", "status", "ACTIVE"));
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<?> endCompetition(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID requesterId = UUID.fromString(claims.getSubject());

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));
        if (!competition.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the creator can end a competition");
        }
        if (competition.getStatus() == CompetitionStatus.ENDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Competition is already ended");
        }
        competition.setStatus(CompetitionStatus.ENDED);
        competitionRepository.save(competition);
        return ResponseEntity.ok(Map.of("message", "Competition ended", "status", "ENDED"));
    }

    // -------------------------------------------------------------------------
    // Teacher read: competition overview stats
    // -------------------------------------------------------------------------

    @GetMapping("/{id}/overview")
    public ResponseEntity<?> getTeacherOverview(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Competition not found"));

        long teamCount        = teamRepository.findByCompetitionId(id).size();
        long submissionCount  = competitionSubmissionRepository.findByCompetitionId(id).size();
        long acCount          = competitionSubmissionRepository.findByCompetitionId(id).stream()
                .filter(s -> s.getVerdict() == com.university.platform.competition.model.CompetitionSubmission.Verdict.AC)
                .count();

        return ResponseEntity.ok(Map.of(
                "competitionId",   id,
                "title",           competition.getTitle(),
                "status",          competition.getStatus().name(),
                "mode",            competition.getMode().name(),
                "scoringMode",     competition.getScoringMode().name(),
                "teamCount",       teamCount,
                "submissionCount", submissionCount,
                "acCount",         acCount
        ));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Claims parseClaims(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        return jwtService.parseToken(authHeader.substring(7));
    }

    private void requireRole(Claims claims, String... allowedRoles) {
        String role = claims.get("role", String.class);
        for (String allowed : allowedRoles) {
            if (allowed.equals(role)) return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Required role: " + String.join(" or ", allowedRoles));
    }
}
