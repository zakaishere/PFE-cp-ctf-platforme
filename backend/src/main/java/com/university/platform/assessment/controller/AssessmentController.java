package com.university.platform.assessment.controller;
import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.VisibilityMode;
import com.university.platform.assessment.repository.AssessmentProblemRepository;
import com.university.platform.assessment.repository.ExamAttemptResultRepository;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.assessment.repository.TPFinalSubmissionRepository;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.dto.CreateAssessmentDTO;
import com.university.platform.assessment.dto.ExamProblemDTO;
import com.university.platform.assessment.dto.ExamRoomDTO;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;

import com.university.platform.academic.model.Module;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.transaction.annotation.Transactional;

import com.university.platform.identity.service.JwtService;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/assessments")
@RequiredArgsConstructor
public class AssessmentController {

    private final AssessmentRepository assessmentRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final ModuleRepository moduleRepository;
    private final ProblemRepository problemRepository;
    private final AssessmentProblemRepository assessmentProblemRepository;
    private final SubmissionRepository submissionRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final ExamAttemptResultRepository examAttemptResultRepository;
    private final TPFinalSubmissionRepository tpFinalSubmissionRepository;
    private final JwtService jwtService;

    @Transactional
    @PostMapping("/exams")
    public ResponseEntity<?> createLiveExam(
            @RequestBody CreateAssessmentDTO dto,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        VisibilityMode visibility = dto.getVisibilityMode() != null
                ? dto.getVisibilityMode()
                : VisibilityMode.MODULE_ONLY;

        if (visibility == VisibilityMode.ACCESS_CODE &&
                (dto.getStrictAccessCode() == null || dto.getStrictAccessCode().isBlank())) {
            return ResponseEntity.badRequest()
                    .body("{\"error\": \"Access code is required when visibility mode is ACCESS_CODE.\"}");
        }

        Module module = null;
        if (visibility == VisibilityMode.MODULE_ONLY) {
            if (dto.getModuleId() == null) {
                return ResponseEntity.badRequest()
                        .body("{\"error\": \"Module is required when visibility mode is MODULE_ONLY.\"}");
            }
            Module found = moduleRepository.findById(dto.getModuleId())
                    .orElseThrow(() -> new RuntimeException("Module not found"));

            boolean ownsModule = teacher.getModules().stream()
                    .anyMatch(m -> m.getModuleId().equals(found.getModuleId()));
            if (!ownsModule) {
                return ResponseEntity.status(403).body("{\"error\": \"You are not assigned to this module\"}");
            }
            module = found;
        } else if (dto.getModuleId() != null) {
            module = moduleRepository.findById(dto.getModuleId()).orElse(null);
        }

        LiveExam exam = LiveExam.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .isPublished(false)
                .createdBy(teacher)
                .scheduledStartTime(dto.getScheduledStartTime())
                .durationMinutes(dto.getDurationMinutes())
                .strictAccessCode(dto.getStrictAccessCode() != null ? dto.getStrictAccessCode() : "")
                .isPenaltyEnabled(dto.getIsPenaltyEnabled() == null ? true : dto.getIsPenaltyEnabled())
                .module(module)
                .visibilityMode(visibility)
                .build();

        assessmentRepository.save(exam);
        return ResponseEntity.status(201).body("{\"message\": \"Live Exam created\", \"assessmentId\": \"" + exam.getAssessmentId() + "\"}");
    }

    @Transactional
    @PostMapping("/tps")
    public ResponseEntity<?> createOpenTP(
            @RequestBody CreateAssessmentDTO dto,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        VisibilityMode visibility = dto.getVisibilityMode() != null
                ? dto.getVisibilityMode()
                : VisibilityMode.MODULE_ONLY;

        if (visibility == VisibilityMode.ACCESS_CODE &&
                (dto.getStrictAccessCode() == null || dto.getStrictAccessCode().isBlank())) {
            return ResponseEntity.badRequest()
                    .body("{\"error\": \"Access code is required when visibility mode is ACCESS_CODE.\"}");
        }

        Module module = null;
        if (visibility == VisibilityMode.MODULE_ONLY) {
            if (dto.getModuleId() == null) {
                return ResponseEntity.badRequest()
                        .body("{\"error\": \"Module is required when visibility mode is MODULE_ONLY.\"}");
            }
            Module found = moduleRepository.findById(dto.getModuleId())
                    .orElseThrow(() -> new RuntimeException("Module not found"));

            boolean ownsModule = teacher.getModules().stream()
                    .anyMatch(m -> m.getModuleId().equals(found.getModuleId()));
            if (!ownsModule) {
                return ResponseEntity.status(403).body("{\"error\": \"You are not assigned to this module\"}");
            }
            module = found;
        } else if (dto.getModuleId() != null) {
            module = moduleRepository.findById(dto.getModuleId()).orElse(null);
        }

        OpenTP tp = OpenTP.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .isPublished(false)
                .createdBy(teacher)
                .deadline(dto.getDeadline())
                .maxAttemptsAllowed(dto.getMaxAttempts())
                .strictAccessCode(dto.getStrictAccessCode())
                .module(module)
                .visibilityMode(visibility)
                .build();

        assessmentRepository.save(tp);
        return ResponseEntity.status(201).body("{\"message\": \"Open TP created\", \"assessmentId\": \"" + tp.getAssessmentId() + "\"}");
    }

    @PostMapping("/{assessmentId}/problems/{problemId}")
    public ResponseEntity<?> addProblemToAssessment(
            @PathVariable UUID assessmentId,
            @PathVariable UUID problemId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        Problem problem = problemRepository.findById(problemId)
                .orElseThrow(() -> new RuntimeException("Problem not found"));

        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            throw new RuntimeException("Unauthorized");
        }

        Integer nextOrder = assessmentProblemRepository.countByAssessment_AssessmentId(assessmentId) + 1;

        AssessmentProblem ap = AssessmentProblem.builder()
                .assessment(assessment)
                .problem(problem)
                .orderIndex(nextOrder)
                .build();
        
        assessmentProblemRepository.save(ap);
        return ResponseEntity.ok().body("{\"message\": \"Problem appended to assessment\"}");
    }

    @GetMapping("/{assessmentId}/student-view")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAssessmentStudentView(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {
        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        String token = authHeader.replace("Bearer ", "");
        io.jsonwebtoken.Claims claims = jwtService.parseToken(token);
        String role = claims.get("role", String.class);

        boolean hasStarted = true;
        if (assessment instanceof LiveExam exam) {
            hasStarted = !java.time.LocalDateTime.now().isBefore(exam.getScheduledStartTime());
        }

        if ("TEACHER".equals(role) || "ADMIN".equals(role)) {
            hasStarted = true; // Bypass restriction for staff
        } else if ("STUDENT".equals(role) && !Boolean.TRUE.equals(assessment.getIsPublished())) {
            return ResponseEntity.status(403).body("{\"error\": \"This assessment has not been published yet.\"}");
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("assessmentId", assessment.getAssessmentId());
        response.put("title", assessment.getTitle());
        response.put("description", assessment.getDescription());
        response.put("isStarted", hasStarted);
        response.put("isPublished", Boolean.TRUE.equals(assessment.getIsPublished()));
        response.put("visibilityMode", assessment.getVisibilityMode() != null
                ? assessment.getVisibilityMode().name() : VisibilityMode.MODULE_ONLY.name());
        
        if (assessment instanceof LiveExam exam) {
            response.put("scheduledStartTime", exam.getScheduledStartTime());
            response.put("durationMinutes", exam.getDurationMinutes());
            response.put("type", "LIVE_EXAM");
            response.put("scoringMode", exam.getScoringMode());
            response.put("passingScore", exam.getPassingScore());
            response.put("gradesRevealed", Boolean.TRUE.equals(exam.getGradesRevealed()));
        } else if (assessment instanceof OpenTP tp) {
            response.put("deadline", tp.getDeadline());
            response.put("type", "OPEN_TP");
            response.put("scoringMode", tp.getScoringMode());
            response.put("penaltyPercent", tp.getPenaltyPercent());
        }
        
        if (hasStarted) {
            List<java.util.Map<String, Object>> problems = assessmentProblemRepository.findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId)
                .stream()
                .map(ap -> {
                    java.util.Map<String, Object> p = new java.util.HashMap<>();
                    p.put("problemId", ap.getProblem().getProblemId());
                    p.put("title", ap.getProblem().getTitle());
                    p.put("difficulty", ap.getProblem().getDifficultyLevel());
                    p.put("orderIndex", ap.getOrderIndex());
                    return p;
                }).toList();
            response.put("problems", problems);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{assessmentId}/score")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAssessmentScore(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {
        
        String token = authHeader.replace("Bearer ", "");
        UUID studentId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        // Fetch all non-planning accepted submissions for this exam and student
        var submissions = submissionRepository.findByAssessment_AssessmentIdAndStudent_IdOrderByTimestampDesc(assessmentId, studentId);
        
        // Group by problem and keep the highest points for each
        java.util.Map<UUID, Double> maxPointsPerProblem = new java.util.HashMap<>();
        for (var sub : submissions) {
            if (Boolean.TRUE.equals(sub.getIsAccepted()) && !sub.isPlanningMode() && sub.getResult() != null) {
                UUID pId = sub.getProblem().getProblemId();
                double pts = sub.getResult().getPointsAwarded() - 
                             (sub.getResult().getTeacherPenaltyOverride() != null ? sub.getResult().getTeacherPenaltyOverride() : 0.0);
                maxPointsPerProblem.put(pId, Math.max(maxPointsPerProblem.getOrDefault(pId, 0.0), pts));
            }
        }

        double totalScore = maxPointsPerProblem.values().stream().mapToDouble(Double::doubleValue).sum();

        return ResponseEntity.ok(Map.of(
            "assessmentId", assessmentId,
            "studentId", studentId,
            "calculatedScore", totalScore
        ));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAllAssessments(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        io.jsonwebtoken.Claims claims = jwtService.parseToken(token);
        String role = claims.get("role", String.class);

        List<Assessment> assessments;
        UUID studentId = null;

        if ("TEACHER".equals(role)) {
            UUID teacherId = UUID.fromString(claims.getSubject());
            assessments = assessmentRepository.findAll().stream()
                .filter(a -> a.getCreatedBy() != null && a.getCreatedBy().getId().equals(teacherId))
                .toList();
        } else if ("STUDENT".equals(role)) {
            studentId = UUID.fromString(claims.getSubject());
            Student student = studentRepository.findById(studentId).orElse(null);
            if (student == null || student.getDivision() == null || student.getSemester() == null) {
                assessments = List.of();
            } else {
                assessments = assessmentRepository.findVisibleToStudent(
                        student.getDivision().getDivisionId(),
                        student.getSemester().getSemesterId());
            }
        } else {
            assessments = assessmentRepository.findAll();
        }

        // Batch pending count — one query for all REQUEST_BASED assessments
        final boolean showPendingCount = "TEACHER".equals(role) || "ADMIN".equals(role);
        final Map<UUID, Long> pendingCountMap;
        if (showPendingCount) {
            List<UUID> requestBasedIds = assessments.stream()
                    .filter(a -> a.getVisibilityMode() == VisibilityMode.REQUEST_BASED)
                    .map(Assessment::getAssessmentId)
                    .toList();
            if (!requestBasedIds.isEmpty()) {
                pendingCountMap = joinRequestRepository
                        .countGroupedByAssessmentId(requestBasedIds, JoinRequestStatus.PENDING)
                        .stream()
                        .collect(Collectors.toMap(
                                row -> (UUID) row[0],
                                row -> (Long) row[1]));
            } else {
                pendingCountMap = Collections.emptyMap();
            }
        } else {
            pendingCountMap = Collections.emptyMap();
        }

        final UUID finalStudentId = studentId;
        List<java.util.Map<String, Object>> response = assessments.stream().map(a -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", a.getAssessmentId());
            map.put("title", a.getTitle());
            map.put("description", a.getDescription());
            if (a.getCreatedBy() != null) {
                map.put("host", "Prof. " + a.getCreatedBy().getLastName());
            } else {
                map.put("host", "Unknown");
            }
            if (a.getModule() != null) {
                map.put("moduleName", a.getModule().getName());
            }

            map.put("visibilityMode", a.getVisibilityMode() != null
                    ? a.getVisibilityMode().name() : VisibilityMode.MODULE_ONLY.name());

            if (a.getVisibilityMode() == VisibilityMode.REQUEST_BASED && finalStudentId != null) {
                String myJoinStatus = joinRequestRepository
                        .findByAssessmentIdAndStudentId(a.getAssessmentId(), finalStudentId)
                        .map(jr -> jr.getStatus().name())
                        .orElse("NOT_REQUESTED");
                map.put("myJoinStatus", myJoinStatus);
            } else {
                map.put("myJoinStatus", null);
            }

            if (showPendingCount && a.getVisibilityMode() == VisibilityMode.REQUEST_BASED) {
                map.put("pendingRequestCount",
                        pendingCountMap.getOrDefault(a.getAssessmentId(), 0L));
            } else {
                map.put("pendingRequestCount", null);
            }

            int problemCount = assessmentProblemRepository.countByAssessment_AssessmentId(a.getAssessmentId());
            map.put("problemsCount", problemCount);
            map.put("strictAccessCode", null);

            boolean isPublished = Boolean.TRUE.equals(a.getIsPublished());
            map.put("isPublished", isPublished);

            if (a instanceof LiveExam exam) {
                map.put("type", "LIVE_EXAM");
                map.put("scheduledStartTime", exam.getScheduledStartTime());
                map.put("durationMinutes", exam.getDurationMinutes());
                // Never send the real code to a student — it must be verified
                // server-side via POST /access, not compared client-side.
                map.put("strictAccessCode", ("TEACHER".equals(role) || "ADMIN".equals(role)) ? exam.getStrictAccessCode() : null);
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime start = exam.getScheduledStartTime();
                LocalDateTime end = start != null && exam.getDurationMinutes() != null
                        ? start.plusMinutes(exam.getDurationMinutes()) : null;
                boolean closed = Boolean.TRUE.equals(exam.getIsClosed()) || (end != null && now.isAfter(end));
                boolean live = !closed && start != null && !now.isBefore(start) && (end == null || now.isBefore(end));
                map.put("status", !isPublished ? "DRAFT" : closed ? "CLOSED" : live ? "LIVE" : "UPCOMING");
            } else if (a instanceof OpenTP tp) {
                map.put("type", "OPEN_TP");
                map.put("deadline", tp.getDeadline());
                map.put("maxAttempts", tp.getMaxAttemptsAllowed());
                boolean tpClosed = tp.getDeadline() != null && LocalDateTime.now().isAfter(tp.getDeadline());
                map.put("status", !isPublished ? "DRAFT" : tpClosed ? "CLOSED" : "OPEN");
            }
            return map;
        }).toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{assessmentId}/exam-room")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getExamRoom(
            @PathVariable UUID assessmentId,
            @RequestParam(required = false) String code,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        io.jsonwebtoken.Claims claims = jwtService.parseToken(token);
        UUID studentId = UUID.fromString(claims.getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId).orElse(null);
        // The arena serves both live exams and open TPs. Anything else has no room.
        if (!(assessment instanceof LiveExam) && !(assessment instanceof OpenTP)) {
            return ResponseEntity.notFound().build();
        }

        if (!Boolean.TRUE.equals(assessment.getIsPublished())) {
            return ResponseEntity.status(403)
                    .body("{\"error\": \"This assessment has not been published yet.\"}");
        }

        VisibilityMode visibility = assessment.getVisibilityMode() != null
                ? assessment.getVisibilityMode() : VisibilityMode.MODULE_ONLY;

        // ACCESS_CODE assessments require the correct code on every entry — the
        // waiting room's own check only ran client-side and never actually gated
        // the arena content, so a student who knew the URL could bypass it. A
        // blank/unset code (assessments created before this was enforced never
        // had one) means nothing was ever configured — don't hard-lock it.
        if (visibility == VisibilityMode.ACCESS_CODE) {
            String expected = assessment instanceof LiveExam exam ? exam.getStrictAccessCode()
                    : assessment instanceof OpenTP tp ? tp.getStrictAccessCode() : null;
            if (expected != null && !expected.isBlank()
                    && (code == null || !expected.equals(code.trim()))) {
                return ResponseEntity.status(403)
                        .body("{\"error\": \"Invalid access code\"}");
            }
        }

        // REQUEST_BASED assessments gate on an approved join request.
        if (visibility == VisibilityMode.REQUEST_BASED) {
            boolean approved = joinRequestRepository.existsByAssessmentIdAndStudentIdAndStatus(
                    assessmentId, studentId, JoinRequestStatus.APPROVED);
            if (!approved) {
                return ResponseEntity.status(403)
                        .body("{\"error\": \"Access denied. You do not have an approved request for this assessment.\"}");
            }
        }

        LocalDateTime now = LocalDateTime.now();

        // Subtype-specific timing + metadata. Exams run a fixed-duration countdown
        // and gate results behind a reveal flag; TPs run to a deadline with a
        // per-problem attempt cap and no anti-cheat.
        long remainingSeconds;
        boolean isEnded;
        String deadlineIso = null;
        Integer maxAttempts = null;
        boolean gradesRevealed = false;
        final boolean isTp = assessment instanceof OpenTP;

        if (assessment instanceof LiveExam exam) {
            LocalDateTime endTime = exam.getScheduledStartTime().plusMinutes(exam.getDurationMinutes());
            remainingSeconds = Math.max(0, ChronoUnit.SECONDS.between(now, endTime));
            isEnded = Boolean.TRUE.equals(exam.getIsClosed()) || remainingSeconds == 0;
            gradesRevealed = Boolean.TRUE.equals(exam.getGradesRevealed());
        } else {
            OpenTP tp = (OpenTP) assessment;
            LocalDateTime deadline = tp.getDeadline();
            remainingSeconds = Math.max(0, ChronoUnit.SECONDS.between(now, deadline));
            isEnded = now.isAfter(deadline);
            deadlineIso = deadline.toString();
            maxAttempts = tp.getMaxAttemptsAllowed();
        }

        Set<UUID> solvedIds = submissionRepository.findSolvedProblemIdsByAssessment(studentId, assessmentId);

        List<AssessmentProblem> aps = assessmentProblemRepository
                .findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId);

        // TP overview/results pages always show per-task earned scores; exams
        // keep them hidden until grades are released (gated below, per-field,
        // not by omitting the lookup — ExamAttemptResult rows exist for both
        // assessment types).
        final Map<UUID, Integer> earnedByProblem =
                examAttemptResultRepository.findByAssessmentIdAndStudentId(assessmentId, studentId).stream()
                        .collect(Collectors.toMap(
                                com.university.platform.assessment.model.ExamAttemptResult::getProblemId,
                                com.university.platform.assessment.model.ExamAttemptResult::getEarnedScore,
                                (a, b) -> a));
        final boolean showEarnedScore = isTp || gradesRevealed;

        String[] labels = {"A","B","C","D","E","F","G","H","I","J"};

        List<ExamProblemDTO> problems = IntStream.range(0, aps.size())
                .mapToObj(i -> {
                    AssessmentProblem ap = aps.get(i);
                    com.university.platform.assessment.model.Problem p = ap.getProblem();
                    String label = i < labels.length ? labels[i] : String.valueOf(i + 1);

                    List<ExamProblemDTO.VisibleTestCaseDTO> visible = p.getTestCases().stream()
                            .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                            .map(tc -> new ExamProblemDTO.VisibleTestCaseDTO(
                                    tc.getTestCaseId(), tc.getInputData(), tc.getExpectedOutput()))
                            .collect(Collectors.toList());

                    int hiddenCount = (int) p.getTestCases().stream()
                            .filter(tc -> Boolean.TRUE.equals(tc.getIsHidden()))
                            .count();

                    // TP top bar shows a per-problem attempt counter; exams don't.
                    Integer attemptsUsed = isTp
                            ? (int) submissionRepository.countAttempts(studentId, p.getProblemId(), assessmentId)
                            : null;

                    return new ExamProblemDTO(
                            p.getProblemId(), label, p.getTitle(),
                            p.getDifficultyLevel().name(),
                            p.getTimeLimitMs(), p.getMemoryLimitMb(),
                            p.getDescription(),
                            ap.effectiveMaxPoints(),
                            visible, hiddenCount,
                            solvedIds.contains(p.getProblemId()),
                            attemptsUsed,
                            showEarnedScore ? earnedByProblem.getOrDefault(p.getProblemId(), 0) : null
                    );
                })
                .collect(Collectors.toList());

        // TP final-submit state for THIS student (null for exams / not submitted).
        String finalSubmittedAt = isTp
                ? tpFinalSubmissionRepository.findByAssessmentIdAndStudentId(assessmentId, studentId)
                        .map(f -> f.getSubmittedAt().toString()).orElse(null)
                : null;

        return ResponseEntity.ok(new ExamRoomDTO(
                assessmentId, assessment.getTitle(), remainingSeconds, isEnded, problems,
                deadlineIso, maxAttempts, gradesRevealed, finalSubmittedAt));
    }

    /**
     * Student's final "Submit TP" — locks their submissions for this TP and
     * flips the arena into the read-only results view. Per-student: only THIS
     * student's work is locked.
     */
    @PostMapping("/{assessmentId}/final-submit")
    @Transactional
    public ResponseEntity<?> finalSubmitTP(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID studentId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!(assessment instanceof OpenTP tp)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only TPs support final submission."));
        }
        if (!Boolean.TRUE.equals(tp.getIsPublished())) {
            return ResponseEntity.status(403).body(Map.of("error", "This TP has not been published yet."));
        }
        if (tp.getDeadline() != null && LocalDateTime.now().isAfter(tp.getDeadline())) {
            return ResponseEntity.status(403).body(Map.of("error", "The deadline for this TP has passed."));
        }
        if (tpFinalSubmissionRepository.existsByAssessmentIdAndStudentId(assessmentId, studentId)) {
            return ResponseEntity.status(409).body(Map.of("error", "You have already submitted this TP."));
        }

        com.university.platform.assessment.model.TPFinalSubmission fs =
                com.university.platform.assessment.model.TPFinalSubmission.builder()
                        .assessmentId(assessmentId)
                        .studentId(studentId)
                        .build();
        tpFinalSubmissionRepository.save(fs);

        return ResponseEntity.ok(Map.of(
                "message", "TP submitted",
                "finalSubmittedAt", fs.getSubmittedAt().toString()));
    }

    /**
     * Teacher releases final grades for a live exam — flips {@code gradesRevealed}
     * so students can see their verdicts/scores. Nothing else in the codebase
     * ever sets this flag; without this endpoint the results view is unreachable.
     */
    @PostMapping("/{assessmentId}/release-grades")
    @Transactional
    public ResponseEntity<?> releaseGrades(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!(assessment instanceof LiveExam exam)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only live exams have grades to release."));
        }
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Unauthorized"));
        }

        exam.setGradesRevealed(true);
        assessmentRepository.save(exam);

        return ResponseEntity.ok(Map.of("message", "Grades released", "gradesRevealed", true));
    }

    @GetMapping("/my-modules")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMyModules(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.substring(7);
        io.jsonwebtoken.Claims claims = jwtService.parseToken(token);
        String role = claims.get("role", String.class);

        List<Map<String, Object>> result;
        if ("ADMIN".equals(role)) {
            result = moduleRepository.findAll().stream()
                    .map(m -> Map.<String, Object>of("id", m.getModuleId(), "name", m.getName()))
                    .toList();
        } else {
            UUID teacherId = UUID.fromString(claims.getSubject());
            Teacher teacher = teacherRepository.findById(teacherId)
                    .orElseThrow(() -> new RuntimeException("Teacher not found"));
            result = teacher.getModules().stream()
                    .map(m -> Map.<String, Object>of("id", m.getModuleId(), "name", m.getName()))
                    .toList();
        }
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{assessmentId}/problems/reorder")
    @Transactional
    public ResponseEntity<?> reorderProblems(
            @PathVariable UUID assessmentId,
            @RequestBody Map<String, List<UUID>> body,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        List<UUID> problemIds = body.get("problemIds");
        if (problemIds == null) return ResponseEntity.badRequest().body(Map.of("error", "problemIds required"));

        List<com.university.platform.assessment.model.AssessmentProblem> aps =
                assessmentProblemRepository.findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId);
        for (int i = 0; i < problemIds.size(); i++) {
            final int idx = i;
            final UUID pid = problemIds.get(i);
            aps.stream()
               .filter(ap -> ap.getProblem().getProblemId().equals(pid))
               .findFirst()
               .ifPresent(ap -> ap.setOrderIndex(idx));
        }
        assessmentProblemRepository.saveAll(aps);
        return ResponseEntity.ok(Map.of("message", "Problems reordered"));
    }

    @PatchMapping("/{assessmentId}/problems/{problemId}")
    @Transactional
    public ResponseEntity<?> updateProblemSettings(
            @PathVariable UUID assessmentId,
            @PathVariable UUID problemId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        com.university.platform.assessment.model.AssessmentProblem ap =
                assessmentProblemRepository.findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId)
                        .stream()
                        .filter(x -> x.getProblem().getProblemId().equals(problemId))
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException("Problem not in assessment"));

        if (body.containsKey("points")) ap.setPointsOverride(((Number) body.get("points")).intValue());
        assessmentProblemRepository.save(ap);
        return ResponseEntity.ok(Map.of("message", "Problem settings updated"));
    }

    @DeleteMapping("/{assessmentId}/problems/{problemId}")
    @Transactional
    public ResponseEntity<?> removeProblem(
            @PathVariable UUID assessmentId,
            @PathVariable UUID problemId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        assessmentProblemRepository.findByAssessment_AssessmentIdOrderByOrderIndexAsc(assessmentId)
                .stream()
                .filter(ap -> ap.getProblem().getProblemId().equals(problemId))
                .findFirst()
                .ifPresent(assessmentProblemRepository::delete);

        return ResponseEntity.ok(Map.of("message", "Problem removed"));
    }

    @PatchMapping("/{assessmentId}/settings")
    @Transactional
    public ResponseEntity<?> updateSettings(
            @PathVariable UUID assessmentId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        if (body.containsKey("title"))       assessment.setTitle((String) body.get("title"));
        if (body.containsKey("description")) assessment.setDescription((String) body.get("description"));

        if (assessment instanceof LiveExam exam) {
            if (body.containsKey("durationMinutes"))
                exam.setDurationMinutes(((Number) body.get("durationMinutes")).intValue());
            if (body.containsKey("isPenaltyEnabled"))
                exam.setIsPenaltyEnabled((Boolean) body.get("isPenaltyEnabled"));
            if (body.containsKey("scheduledStartTime")) {
                String raw = (String) body.get("scheduledStartTime");
                exam.setScheduledStartTime(java.time.LocalDateTime.parse(raw,
                        java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")));
            }
            if (body.containsKey("scoringMode"))
                exam.setScoringMode((String) body.get("scoringMode"));
            if (body.containsKey("passingScore"))
                exam.setPassingScore(((Number) body.get("passingScore")).intValue());
        } else if (assessment instanceof OpenTP tp) {
            if (body.containsKey("maxAttemptsAllowed"))
                tp.setMaxAttemptsAllowed(((Number) body.get("maxAttemptsAllowed")).intValue());
            if (body.containsKey("strictAccessCode"))
                tp.setStrictAccessCode((String) body.get("strictAccessCode"));
            if (body.containsKey("deadline")) {
                String raw = (String) body.get("deadline");
                tp.setDeadline(java.time.LocalDateTime.parse(raw,
                        java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")));
            }
            if (body.containsKey("scoringMode"))
                tp.setScoringMode((String) body.get("scoringMode"));
            if (body.containsKey("penaltyPercent"))
                tp.setPenaltyPercent(((Number) body.get("penaltyPercent")).intValue());
        }

        assessmentRepository.save(assessment);
        return ResponseEntity.ok(Map.of("message", "Settings updated"));
    }

    @PostMapping("/{assessmentId}/publish")
    @Transactional
    public ResponseEntity<?> publishAssessment(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        assessment.setIsPublished(true);
        assessmentRepository.save(assessment);
        return ResponseEntity.ok(Map.of("message", "Published", "isPublished", true));
    }

    @PostMapping("/{assessmentId}/unpublish")
    @Transactional
    public ResponseEntity<?> unpublishAssessment(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));
        if (!assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body("{\"error\": \"Unauthorized\"}");
        }

        assessment.setIsPublished(false);
        assessmentRepository.save(assessment);
        return ResponseEntity.ok(Map.of("message", "Unpublished", "isPublished", false));
    }

    @PostMapping("/{assessmentId}/access")
    public ResponseEntity<?> accessAssessment(
            @PathVariable UUID assessmentId,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {

        Assessment assessment = assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new RuntimeException("Assessment not found"));

        VisibilityMode visibility = assessment.getVisibilityMode() != null
                ? assessment.getVisibilityMode() : VisibilityMode.MODULE_ONLY;

        if (visibility == VisibilityMode.ACCESS_CODE) {
            String provided = body.get("accessCode");
            String expected = assessment instanceof LiveExam exam ? exam.getStrictAccessCode()
                    : assessment instanceof OpenTP tp ? tp.getStrictAccessCode() : null;
            // Blank/unset code = nothing was ever configured — don't hard-lock it.
            if (expected != null && !expected.isBlank()
                    && (provided == null || !expected.equals(provided.trim()))) {
                return ResponseEntity.status(403).body(Map.of("error", "Invalid access code"));
            }
        }

        return ResponseEntity.ok(Map.of("message", "Access granted"));
    }
}
