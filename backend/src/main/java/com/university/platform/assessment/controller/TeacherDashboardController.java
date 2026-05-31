package com.university.platform.assessment.controller;

import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.ctf.entity.CTFCompetition;
import com.university.platform.ctf.repository.CTFCompetitionRepository;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Teacher dashboard overview endpoint.
 * GET /api/teacher/dashboard/overview
 */
@RestController
@RequestMapping("/api/teacher/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TeacherDashboardController {

    private final CompetitionRepository  competitionRepository;
    private final AssessmentRepository   assessmentRepository;
    private final CTFCompetitionRepository ctfRepository;
    private final JwtService             jwtService;

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview(
            @RequestHeader("Authorization") String authHeader) {

        String token    = authHeader.replace("Bearer ", "");
        UUID   teacherId = jwtService.extractUserId(token);
        LocalDateTime now = LocalDateTime.now();

        // ── Competitions ───────────────────────────────────────────────────
        List<Competition> myComps = competitionRepository.findByCreatedByOrderByStartTimeDesc(teacherId);
        List<Competition> activeComps   = myComps.stream().filter(c -> c.getStatus() == CompetitionStatus.ACTIVE).toList();
        List<Competition> upcomingComps = myComps.stream().filter(c -> c.getStatus() == CompetitionStatus.REGISTRATION).toList();

        // ── Exams ──────────────────────────────────────────────────────────
        List<LiveExam> activeExams = assessmentRepository.findActiveExamsByTeacher(teacherId, now);
        List<Assessment> allAssessments = assessmentRepository.findByTeacherIdOrderByIdDesc(teacherId);
        List<LiveExam> upcomingExams = allAssessments.stream()
                .filter(a -> a instanceof LiveExam le
                        && le.getScheduledStartTime() != null
                        && le.getScheduledStartTime().isAfter(now))
                .map(a -> (LiveExam) a)
                .toList();

        // ── TPs ────────────────────────────────────────────────────────────
        List<OpenTP> openTPs = assessmentRepository.findOpenTPsByTeacher(teacherId, now);

        // ── CTFs ───────────────────────────────────────────────────────────
        List<CTFCompetition> allCtfs  = ctfRepository.findByCreatedByOrderByCreatedAtDesc(teacherId);
        List<CTFCompetition> activeCtfs   = allCtfs.stream()
                .filter(c -> c.computeStatus() == CTFCompetition.Status.ACTIVE).toList();
        List<CTFCompetition> upcomingCtfs = allCtfs.stream()
                .filter(c -> c.computeStatus() == CTFCompetition.Status.UPCOMING).toList();

        // ── Stats ──────────────────────────────────────────────────────────
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("competitions", Map.of(
                "active", activeComps.size(),
                "upcoming", upcomingComps.size(),
                "total", myComps.size()
        ));
        stats.put("exams", Map.of(
                "active", activeExams.size(),
                "upcoming", upcomingExams.size(),
                "total", allAssessments.stream().filter(a -> a instanceof LiveExam).count()
        ));
        stats.put("tps", Map.of(
                "open", openTPs.size(),
                "total", allAssessments.stream().filter(a -> a instanceof OpenTP).count()
        ));
        stats.put("ctfs", Map.of(
                "active", activeCtfs.size(),
                "upcoming", upcomingCtfs.size(),
                "total", allCtfs.size()
        ));

        // ── Upcoming events (next 7 days) ──────────────────────────────────
        LocalDateTime in7 = now.plusDays(7);
        List<Map<String, Object>> upcoming = new ArrayList<>();

        upcomingComps.stream()
                .filter(c -> c.getStartTime() != null && c.getStartTime().isBefore(in7))
                .forEach(c -> upcoming.add(event("COMPETITION", c.getCompetitionId().toString(),
                        c.getTitle(), c.getStartTime(), "/teacher/competitions/" + c.getCompetitionId() + "/manage")));

        upcomingExams.stream()
                .filter(e -> e.getScheduledStartTime() != null && e.getScheduledStartTime().isBefore(in7))
                .forEach(e -> upcoming.add(event("EXAM", e.getAssessmentId().toString(),
                        e.getTitle(), e.getScheduledStartTime(), "/teacher/exams/" + e.getAssessmentId() + "/manage")));

        upcomingCtfs.stream()
                .filter(c -> c.getStartTime() != null && c.getStartTime().isBefore(in7))
                .forEach(c -> upcoming.add(event("CTF", c.getId().toString(),
                        c.getTitle(), c.getStartTime(), "/teacher/ctf/" + c.getId() + "/manage")));

        upcoming.sort(Comparator.comparing(e -> (String) e.get("startTime")));

        // ── Active competition summaries ────────────────────────────────────
        List<Map<String, Object>> activeCompSummaries = activeComps.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getCompetitionId().toString());
            m.put("title", c.getTitle());
            m.put("status", c.getStatus().name());
            m.put("startTime", c.getStartTime() != null ? c.getStartTime().toString() : null);
            m.put("durationMinutes", c.getDurationMinutes());
            m.put("mode", c.getMode().name());
            m.put("manageUrl", "/teacher/competitions/" + c.getCompetitionId() + "/manage");
            return m;
        }).toList();

        // ── Active exam summaries ───────────────────────────────────────────
        List<Map<String, Object>> activeExamSummaries = activeExams.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getAssessmentId().toString());
            m.put("title", e.getTitle());
            m.put("status", "ACTIVE");
            m.put("scheduledStartTime", e.getScheduledStartTime() != null ? e.getScheduledStartTime().toString() : null);
            m.put("durationMinutes", e.getDurationMinutes());
            m.put("manageUrl", "/teacher/exams/" + e.getAssessmentId() + "/manage");
            return m;
        }).toList();

        // ── Open TP summaries ───────────────────────────────────────────────
        List<Map<String, Object>> openTPSummaries = openTPs.stream().map(tp -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", tp.getAssessmentId().toString());
            m.put("title", tp.getTitle());
            m.put("status", "OPEN");
            m.put("deadline", tp.getDeadline() != null ? tp.getDeadline().toString() : null);
            m.put("manageUrl", "/teacher/tps/" + tp.getAssessmentId() + "/manage");
            return m;
        }).toList();

        // ── Active CTF summaries ────────────────────────────────────────────
        List<Map<String, Object>> activeCtfSummaries = activeCtfs.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId().toString());
            m.put("title", c.getTitle());
            m.put("status", "ACTIVE");
            m.put("startTime", c.getStartTime() != null ? c.getStartTime().toString() : null);
            m.put("manageUrl", "/teacher/ctf/" + c.getId() + "/manage");
            return m;
        }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", stats);
        result.put("activeCompetitions", activeCompSummaries);
        result.put("activeExams", activeExamSummaries);
        result.put("openTPs", openTPSummaries);
        result.put("activeCtfs", activeCtfSummaries);
        result.put("upcomingEvents", upcoming);

        return ResponseEntity.ok(result);
    }

    private Map<String, Object> event(String type, String id, String title,
                                      LocalDateTime startTime, String manageUrl) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("id", id);
        m.put("title", title);
        m.put("startTime", startTime != null ? startTime.toString() : null);
        m.put("manageUrl", manageUrl);
        return m;
    }
}
