package com.university.platform.identity.controller;
import com.university.platform.identity.model.Admin;

import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.dto.AdminUserDTO;
import com.university.platform.identity.model.User;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.UserRepository;
import com.university.platform.identity.service.EmailService;
import com.university.platform.audit.AuditDomain;
import com.university.platform.audit.AuditEventService;
import com.university.platform.audit.Severity;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.competition.repository.CompetitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final TeacherRepository     teacherRepository;
    private final StudentRepository     studentRepository;
    private final AssessmentRepository  assessmentRepository;
    private final ProblemRepository     problemRepository;
    private final SubmissionRepository  submissionRepository;
    private final CompetitionRepository competitionRepository;
    private final UserRepository        userRepository;
    private final EmailService          emailService;
    private final AuditEventService     auditEventService;

    /** Resolves the authenticated admin's UUID from the JWT principal (the token subject). */
    private UUID currentAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return null;
        try {
            return UUID.fromString(auth.getPrincipal().toString());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    @Autowired(required = false)
    private AmqpAdmin amqpAdmin;

    @Autowired(required = false)
    private DataSource dataSource;

    @Autowired(required = false)
    private HealthEndpoint healthEndpoint;

    @GetMapping("/pending-teachers")
    public ResponseEntity<List<Teacher>> getPendingTeachers() {
        List<Teacher> pending = teacherRepository
                .findByStatusAndIsEmailVerifiedTrue(TeacherStatus.PENDING);
        return ResponseEntity.ok(pending);
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getPlatformStats() {
        LocalDateTime now = LocalDateTime.now();

        // Live exams that are currently within their time window.
        long activeLiveExams = assessmentRepository.findStartedLiveExams(now).stream()
                .filter(e -> {
                    Integer mins = e.getDurationMinutes();
                    if (mins == null || mins <= 0) return false;
                    LocalDateTime end = e.getScheduledStartTime().plusMinutes(mins);
                    return end.isAfter(now);
                })
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTeachers",      teacherRepository.count());
        stats.put("activeTeachers",     teacherRepository.countByStatus(TeacherStatus.ACTIVE));
        stats.put("pendingTeachers",    teacherRepository.countByStatus(TeacherStatus.PENDING));
        stats.put("totalStudents",      studentRepository.count());
        stats.put("totalProblems",      problemRepository.count());
        stats.put("totalSubmissions",   submissionRepository.count());
        stats.put("activeLiveExams",    activeLiveExams);
        stats.put("openTps",            assessmentRepository.countOpenTPs(now));
        stats.put("totalCompetitions",  competitionRepository.count());
        return ResponseEntity.ok(stats);
    }

    @PutMapping("/teachers/{id}/activate")
    @Transactional
    public ResponseEntity<Map<String, String>> activateTeacher(@PathVariable UUID id) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Teacher not found with id: " + id));

        if (teacher.getStatus() == TeacherStatus.ACTIVE) {
            return ResponseEntity.ok(Map.of("message", "Teacher account is already active."));
        }

        if (!teacher.getIsEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot activate a teacher whose email is not yet verified.");
        }

        teacher.setStatus(TeacherStatus.ACTIVE);
        teacherRepository.save(teacher);

        emailService.sendTeacherApprovedEmail(teacher.getEmail(), teacher.getFirstName());
        log.info("[ADMIN] Teacher activated: {}", teacher.getEmail());

        auditEventService.record(
                AuditDomain.ADMIN, "TEACHER_APPROVED",
                teacher.getId(), null, currentAdminId(), null, null,
                Map.of("teacherEmail", teacher.getEmail(),
                       "teacherName", teacher.getFirstName() + " " + teacher.getLastName()),
                Severity.INFO);

        return ResponseEntity.ok(Map.of("message",
                "Teacher " + teacher.getFirstName() + " " + teacher.getLastName()
                + " has been activated. Approval email sent."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin dashboard overview
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/dashboard/overview")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getDashboardOverview() {
        LocalDateTime now = LocalDateTime.now();

        long activeLiveExams = assessmentRepository.findStartedLiveExams(now).stream()
                .filter(e -> {
                    Integer mins = e.getDurationMinutes();
                    if (mins == null || mins <= 0) return false;
                    return now.isBefore(e.getScheduledStartTime().plusMinutes(mins));
                })
                .count();

        long activeCompetitions = competitionRepository.countByStatus(CompetitionStatus.ACTIVE);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTeachers",      teacherRepository.count());
        stats.put("activeTeachers",     teacherRepository.countByStatus(TeacherStatus.ACTIVE));
        stats.put("pendingTeachers",    teacherRepository.countByStatus(TeacherStatus.PENDING));
        stats.put("totalStudents",      studentRepository.count());
        stats.put("totalProblems",      problemRepository.count());
        stats.put("totalSubmissions",   submissionRepository.count());
        stats.put("activeLiveExams",    activeLiveExams);
        stats.put("openTps",            assessmentRepository.countOpenTPs(now));
        stats.put("totalCompetitions",  competitionRepository.count());
        stats.put("activeCompetitions", activeCompetitions);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stats", stats);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin health metrics (simplified, used by admin dashboard UI)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/health/metrics")
    public ResponseEntity<Map<String, Object>> getHealthMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // RabbitMQ queue depth
        Map<String, Object> rabbit = new LinkedHashMap<>();
        try {
            if (amqpAdmin != null) {
                QueueInformation info = amqpAdmin.getQueueInfo("psp.submission.queue");
                int depth = info != null ? info.getMessageCount() : 0;
                rabbit.put("queueDepth", depth);
                rabbit.put("status", depth > 200 ? "CRITICAL" : depth > 50 ? "WARN" : "OK");
            } else {
                rabbit.put("queueDepth", -1);
                rabbit.put("status", "UNKNOWN");
            }
        } catch (Exception ex) {
            rabbit.put("queueDepth", -1);
            rabbit.put("status", "UNKNOWN");
        }
        metrics.put("rabbitmq", rabbit);

        // DB connection pool
        Map<String, Object> db = new LinkedHashMap<>();
        try {
            if (dataSource != null && dataSource instanceof com.zaxxer.hikari.HikariDataSource hds) {
                var pool = hds.getHikariPoolMXBean();
                if (pool != null) {
                    int active = pool.getActiveConnections();
                    int total  = hds.getMaximumPoolSize();
                    db.put("active", active);
                    db.put("total", total);
                    db.put("status", active >= total - 2 ? "CRITICAL" : active > total * 0.8 ? "WARN" : "OK");
                } else {
                    db.put("status", "UNKNOWN");
                }
            } else {
                db.put("status", "UNKNOWN");
            }
        } catch (Exception ex) {
            db.put("status", "UNKNOWN");
        }
        metrics.put("database", db);

        // JVM heap
        Map<String, Object> heap = new LinkedHashMap<>();
        Runtime rt = Runtime.getRuntime();
        long usedMb  = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long totalMb = rt.maxMemory() / (1024 * 1024);
        int heapPct  = totalMb > 0 ? (int) (usedMb * 100 / totalMb) : 0;
        heap.put("usedMb",  usedMb);
        heap.put("totalMb", totalMb);
        heap.put("pct",     heapPct);
        heap.put("status",  heapPct >= 90 ? "CRITICAL" : heapPct >= 75 ? "WARN" : "OK");
        metrics.put("heap", heap);

        // Overall
        boolean critical = metrics.values().stream()
                .filter(v -> v instanceof Map)
                .anyMatch(v -> "CRITICAL".equals(((Map<?, ?>) v).get("status")));
        boolean warn = metrics.values().stream()
                .filter(v -> v instanceof Map)
                .anyMatch(v -> "WARN".equals(((Map<?, ?>) v).get("status")));
        metrics.put("overall", critical ? "CRITICAL" : warn ? "WARN" : "OK");

        return ResponseEntity.ok(metrics);
    }

    @DeleteMapping("/teachers/{id}/reject")
    @Transactional
    public ResponseEntity<Map<String, String>> rejectTeacher(@PathVariable UUID id) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Teacher not found with id: " + id));

        if (teacher.getStatus() == TeacherStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reject an already active teacher.");
        }

        // Capture identity before deletion so the audit record survives the row.
        UUID teacherId = teacher.getId();
        String teacherEmail = teacher.getEmail();
        String teacherName = teacher.getFirstName() + " " + teacher.getLastName();

        teacherRepository.delete(teacher);
        log.info("[ADMIN] Teacher rejected and deleted: {}", teacherEmail);

        auditEventService.record(
                AuditDomain.ADMIN, "TEACHER_REJECTED",
                teacherId, null, currentAdminId(), null, null,
                Map.of("teacherEmail", teacherEmail, "teacherName", teacherName),
                Severity.WARN);

        return ResponseEntity.ok(Map.of("message", "Teacher application has been rejected."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Users list (read-only) — search + role filter + pagination.
    // Inspect only; no suspend/ban/role-change in this pass.
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    @Transactional(readOnly = true)
    public ResponseEntity<Page<AdminUserDTO>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        User.Role roleFilter = null;
        if (role != null && !role.isBlank()) {
            try {
                roleFilter = User.Role.valueOf(role.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown role: " + role);
            }
        }
        String searchFilter = (search != null && !search.isBlank()) ? search.trim() : null;

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        Page<AdminUserDTO> result = userRepository
                .searchForAdmin(roleFilter, searchFilter, pageable)
                .map(AdminUserDTO::from);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KPI: submissions created today (server-local day).
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/stats/submissions-today")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Long>> submissionsToday() {
        LocalDateTime startOfDay = LocalDate.now(ZoneId.systemDefault()).atStartOfDay();
        long count = submissionRepository.countByTimestampAfter(startOfDay);
        return ResponseEntity.ok(Map.of("count", count));
    }
}
