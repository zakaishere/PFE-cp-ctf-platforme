package com.university.platform.assessment.controller;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.dto.ScoreboardDTO;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.model.ExamAttemptResult;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentProblemRepository;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.ExamAttemptResultRepository;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.ResultRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.execution.service.ScoringService;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.EmailService;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
public class TeacherReviewController {

    private final SubmissionRepository submissionRepository;
    private final ResultRepository resultRepository;
    private final TeacherRepository teacherRepository;
    private final AssessmentRepository assessmentRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AssessmentProblemRepository assessmentProblemRepository;
    private final ExamAttemptResultRepository examAttemptResultRepository;
    private final StudentRepository studentRepository;
    private final EmailService emailService;
    private final JwtService jwtService;
    private final ScoringService scoringService;

    @PostMapping("/exams/{examId}/close")
    @Transactional
    public ResponseEntity<?> closeExam(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);

        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        Assessment assessment = assessmentRepository.findById(examId).orElse(null);
        if (!(assessment instanceof LiveExam exam)) {
            return ResponseEntity.status(404).body(Map.of("error", "Exam not found"));
        }
        if (!exam.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        // Persist the closed flag
        exam.setIsClosed(true);
        assessmentRepository.save(exam);

        // Auto-reject any still-pending join requests
        String rejectionReason = "The exam has been closed by the teacher.";
        List<JoinRequest> pending =
                joinRequestRepository.findByAssessmentIdAndStatus(examId, JoinRequestStatus.PENDING);
        for (JoinRequest jr : pending) {
            jr.setStatus(JoinRequestStatus.REJECTED);
            jr.setRejectionReason(rejectionReason);
            jr.setDecidedAt(LocalDateTime.now());
            joinRequestRepository.save(jr);
            pushRejectionToStudent(jr.getStudentId(), exam.getTitle(), examId, rejectionReason);
            emailService.sendJoinRequestRejected(jr.getStudentId(), exam.getTitle(), rejectionReason);
        }

        return ResponseEntity.ok(Map.of("message", "Exam closed successfully"));
    }

    private void pushRejectionToStudent(UUID studentId, String targetTitle,
                                         UUID targetId, String reason) {
        try {
            messagingTemplate.convertAndSend(
                    "/topic/students/" + studentId + "/notifications",
                    Map.of("type", "JOIN_REQUEST_REJECTED",
                           "targetTitle", targetTitle,
                           "targetId", targetId.toString(),
                           "isCompetition", false,
                           "reason", reason));
        } catch (Exception ex) {
            // non-critical
        }
    }

    @GetMapping("/exams/{examId}/submissions")
    public ResponseEntity<?> getSubmissions(
            @PathVariable UUID examId,
            @RequestParam(required = false) UUID studentId,
            @RequestParam(required = false) UUID problemId,
            @RequestHeader("Authorization") String authHeader,
            Pageable pageable) {
        
        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);
        
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        // Simplistic implementation for the test
        // Ideally we'd use a Specification<Submission> to filter properly
        Page<Submission> submissions;
        if (studentId != null) {
            var list = submissionRepository.findByAssessment_AssessmentIdAndStudent_IdOrderByTimestampDesc(examId, studentId);
            int start = (int) pageable.getOffset();
            int end = Math.min((start + pageable.getPageSize()), list.size());
            submissions = new org.springframework.data.domain.PageImpl<>(
                    list.subList(start, end), pageable, list.size()
            );
        } else {
            submissions = submissionRepository.findByAssessment_AssessmentId(examId, pageable);
        }

        var responseContent = submissions.map(sub -> {
            boolean hasResult = sub.getResult() != null;
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("submissionId", sub.getSubmissionId());
            map.put("studentId", sub.getStudent().getId());
            map.put("studentFirstName", sub.getStudent().getFirstName());
            map.put("studentLastName", sub.getStudent().getLastName());
            map.put("problemId", sub.getProblem().getProblemId());
            map.put("sourceCode", sub.getSourceCode());
            map.put("pointsAwarded", hasResult ? sub.getResult().getPointsAwarded() : 0.0);
            map.put("teacherPenaltyOverride", hasResult ? sub.getResult().getTeacherPenaltyOverride() : 0.0);
            map.put("status", hasResult ? sub.getResult().getStatus().name() : "PENDING");
            map.put("isAccepted", Boolean.TRUE.equals(sub.getIsAccepted()));
            map.put("timestamp", sub.getTimestamp());
            map.put("result", hasResult ? Map.of(
                    "pointsAwarded", sub.getResult().getPointsAwarded(),
                    "status", sub.getResult().getStatus().name()
            ) : null);
            return map;
        });

        return ResponseEntity.ok(responseContent);
    }

    /** Raw per-submission CSV — every attempt, one row each. */
    @GetMapping(value = "/exams/{examId}/submissions/export", produces = "text/csv")
    public ResponseEntity<byte[]> exportSubmissionsCsv(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        UUID teacherId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        List<Submission> all = submissionRepository.findByAssessment_AssessmentIdOrderByTimestampDesc(examId);

        StringBuilder csv = new StringBuilder();
        csv.append("Student,Points,Status,Submitted\n");
        for (Submission sub : all) {
            boolean hasResult = sub.getResult() != null;
            csv.append(String.format("\"%s %s\",%s,\"%s\",\"%s\"\n",
                    csvSafe(sub.getStudent().getFirstName()),
                    csvSafe(sub.getStudent().getLastName()),
                    hasResult ? sub.getResult().getPointsAwarded() : 0.0,
                    hasResult ? sub.getResult().getStatus().name() : "PENDING",
                    sub.getTimestamp()));
        }

        return csvResponse(csv.toString(), "submissions-" + examId + ".csv");
    }

    /** Per-problem, per-student score grid — powers the manage page's Scores tab. */
    @GetMapping("/exams/{examId}/scores")
    public ResponseEntity<?> getScoreboard(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        UUID teacherId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
        Assessment assessment = assessmentRepository.findById(examId).orElse(null);
        if (assessment == null) return ResponseEntity.notFound().build();
        if (assessment.getCreatedBy() == null || !assessment.getCreatedBy().getId().equals(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        List<AssessmentProblem> problems = assessmentProblemRepository
                .findByAssessment_AssessmentIdOrderByOrderIndexAsc(examId);
        List<ScoreboardDTO.ProblemDTO> problemDtos = problems.stream()
                .map(ap -> new ScoreboardDTO.ProblemDTO(
                        ap.getProblem().getProblemId(), ap.getProblem().getTitle(), ap.effectiveMaxPoints()))
                .toList();

        List<ExamAttemptResult> allResults = examAttemptResultRepository.findByAssessmentId(examId);
        Map<UUID, List<ExamAttemptResult>> byStudent = allResults.stream()
                .collect(java.util.stream.Collectors.groupingBy(ExamAttemptResult::getStudentId));

        Map<UUID, Student> students = studentRepository
                .findAllById(byStudent.keySet()).stream()
                .collect(java.util.stream.Collectors.toMap(Student::getId, s -> s));

        boolean isTp = assessment instanceof OpenTP;
        Integer passingScore = assessment instanceof LiveExam exam ? exam.getPassingScore() : null;
        String scoringMode = isTp ? ((OpenTP) assessment).getScoringMode() : ((LiveExam) assessment).getScoringMode();
        Integer penaltyPercent = isTp ? ((OpenTP) assessment).getPenaltyPercent() : null;

        List<ScoreboardDTO.StudentRowDTO> rows = byStudent.entrySet().stream().map(entry -> {
            UUID studentId = entry.getKey();
            Map<UUID, ExamAttemptResult> byProblem = entry.getValue().stream()
                    .collect(java.util.stream.Collectors.toMap(ExamAttemptResult::getProblemId, r -> r, (a, b) -> a));

            List<ScoreboardDTO.CellDTO> cells = problems.stream().map(ap -> {
                UUID pId = ap.getProblem().getProblemId();
                ExamAttemptResult r = byProblem.get(pId);
                int maxPoints = ap.effectiveMaxPoints();
                if (r == null) {
                    return new ScoreboardDTO.CellDTO(pId, 0, maxPoints, 0, null);
                }
                String verdict = r.getAttempts() == 0 ? null
                        : r.isSolved() ? "AC"
                        : r.getBestPassed() > 0 ? "PARTIAL"
                        : "WA";
                return new ScoreboardDTO.CellDTO(pId, r.getEarnedScore(), maxPoints, r.getAttempts(), verdict);
            }).toList();

            int totalScore = cells.stream().mapToInt(ScoreboardDTO.CellDTO::earnedPoints).sum();
            int totalPossible = cells.stream().mapToInt(ScoreboardDTO.CellDTO::maxPoints).sum();
            int percentage = totalPossible > 0 ? (int) Math.round(totalScore * 100.0 / totalPossible) : 0;
            String status = passingScore != null
                    ? (percentage >= passingScore ? "PASS" : "FAIL")
                    : null;

            Student student = students.get(studentId);
            String fullName = student != null ? student.getFirstName() + " " + student.getLastName() : "Unknown";
            String email = student != null ? student.getEmail() : "";

            return new ScoreboardDTO.StudentRowDTO(
                    studentId, fullName, email, totalScore, totalPossible, percentage, status, cells);
        }).sorted(Comparator.comparing(ScoreboardDTO.StudentRowDTO::fullName)).toList();

        return ResponseEntity.ok(new ScoreboardDTO(
                assessment.getTitle(), isTp ? "OPEN_TP" : "LIVE_EXAM",
                scoringMode, penaltyPercent, passingScore, problemDtos, rows));
    }

    /** Per-student rollup CSV — best score per problem, summed, plus last activity. */
    @GetMapping(value = "/exams/{examId}/results/export", produces = "text/csv")
    public ResponseEntity<byte[]> exportResultsCsv(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        UUID teacherId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        List<Submission> all = submissionRepository.findByAssessment_AssessmentIdOrderByTimestampDesc(examId);

        // Group by student, keep the best (max points) result per problem, sum those.
        Map<UUID, Map<String, Object>> byStudent = new LinkedHashMap<>();
        Map<UUID, Map<UUID, Double>> bestPerProblem = new LinkedHashMap<>();

        for (Submission sub : all) {
            UUID studentId = sub.getStudent().getId();
            byStudent.computeIfAbsent(studentId, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("firstName", sub.getStudent().getFirstName());
                m.put("lastName", sub.getStudent().getLastName());
                m.put("email", sub.getStudent().getEmail());
                m.put("lastActive", sub.getTimestamp());
                m.put("status", "PENDING");
                return m;
            });
            Map<String, Object> row = byStudent.get(studentId);
            LocalDateTime lastActive = (LocalDateTime) row.get("lastActive");
            if (sub.getTimestamp().isAfter(lastActive)) {
                row.put("lastActive", sub.getTimestamp());
            }
            if (sub.getResult() != null) {
                row.put("status", sub.getResult().getStatus().name());
                bestPerProblem.computeIfAbsent(studentId, k -> new LinkedHashMap<>())
                        .merge(sub.getProblem().getProblemId(), sub.getResult().getPointsAwarded(), Math::max);
            }
        }

        StringBuilder csv = new StringBuilder();
        csv.append("Student,Email,Score,Status,Last Active\n");
        byStudent.forEach((studentId, row) -> {
            double totalScore = bestPerProblem.getOrDefault(studentId, Map.of())
                    .values().stream().mapToDouble(Double::doubleValue).sum();
            csv.append(String.format("\"%s %s\",\"%s\",%.1f,\"%s\",\"%s\"\n",
                    csvSafe((String) row.get("firstName")),
                    csvSafe((String) row.get("lastName")),
                    csvSafe((String) row.get("email")),
                    totalScore,
                    row.get("status"),
                    row.get("lastActive")));
        });

        return csvResponse(csv.toString(), "results-" + examId + ".csv");
    }

    private static String csvSafe(String s) {
        return s == null ? "" : s.replace("\"", "\"\"");
    }

    private static ResponseEntity<byte[]> csvResponse(String csv, String filename) {
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @PostMapping("/submissions/{submissionId}/penalty")
    public ResponseEntity<?> applyPenalty(
            @PathVariable UUID submissionId,
            @RequestBody PenaltyRequest req,
            @RequestHeader("Authorization") String authHeader) {
        
        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);
        
        if (!teacherRepository.existsById(teacherId)) {
            return ResponseEntity.status(403).build();
        }

        Result result = resultRepository.findBySubmission_SubmissionId(submissionId)
                .orElseThrow(() -> new RuntimeException("Result not found for submission"));

        result.setTeacherPenaltyOverride(req.penaltyValue());
        result.setFeedback(result.getFeedback() + "\n[Teacher Review]: " + req.reason());
        
        resultRepository.save(result);
        
        return ResponseEntity.ok(Map.of("message", "Penalty applied successfully"));
    }

    public record PenaltyRequest(Double penaltyValue, String reason) {}
}
