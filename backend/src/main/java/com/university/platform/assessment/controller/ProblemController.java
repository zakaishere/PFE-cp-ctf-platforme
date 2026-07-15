package com.university.platform.assessment.controller;

import com.university.platform.assessment.dto.CreateProblemDTO;
import com.university.platform.assessment.dto.ProblemBrowseDTO;
import com.university.platform.assessment.dto.ProblemDetailDTO;
import com.university.platform.assessment.dto.UpdateProblemDTO;
import com.university.platform.assessment.model.AssessmentProblem;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.model.TestCase;
import com.university.platform.assessment.repository.AssessmentProblemRepository;
import com.university.platform.assessment.repository.ProblemRepository;
import com.university.platform.competition.repository.CompetitionProblemRepository;
import com.university.platform.execution.dto.RunRequestDTO;
import com.university.platform.execution.dto.RunResultDTO;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.execution.service.DockerService;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/problems")
@RequiredArgsConstructor
public class ProblemController {

    private final ProblemRepository problemRepository;
    private final AssessmentProblemRepository assessmentProblemRepository;
    private final CompetitionProblemRepository competitionProblemRepository;
    private final TeacherRepository teacherRepository;
    private final JwtService jwtService;
    private final SubmissionRepository submissionRepository;
    private final DockerService dockerService;

    @Transactional
    @PostMapping
    public ResponseEntity<?> createProblem(
            @RequestBody CreateProblemDTO dto,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID teacherId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Teacher teacher = teacherRepository.findById(teacherId).orElse(null);

        String diffStr = dto.getDifficultyLevel() != null ? dto.getDifficultyLevel().toUpperCase() : "EASY";
        boolean isPublic = dto.getIsPublic() != null ? dto.getIsPublic() : false;
        Problem.ProblemVisibility visibility = dto.getVisibility() != null
                ? Problem.ProblemVisibility.valueOf(dto.getVisibility())
                : (isPublic ? Problem.ProblemVisibility.GLOBAL : Problem.ProblemVisibility.PRIVATE);

        Problem problem = Problem.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .difficultyLevel(Problem.DifficultyLevel.valueOf(diffStr))
                .isPublic(isPublic)
                .visibility(visibility)
                .timeLimitMs(dto.getTimeLimitMs() != null ? dto.getTimeLimitMs() : 2000)
                .memoryLimitMb(dto.getMemoryLimitMb() != null ? dto.getMemoryLimitMb() : 256)
                .createdBy(teacher)
                .tags(dto.getTags() != null ? new ArrayList<>(dto.getTags()) : new ArrayList<>())
                .category(dto.getCategory())
                .hints(dto.getHints() != null ? new ArrayList<>(dto.getHints()) : new ArrayList<>())
                .build();

        if (dto.getTestCases() != null) {
            List<TestCase> testCases = dto.getTestCases().stream().map(tcDto ->
                    TestCase.builder()
                            .inputData(tcDto.getInputData() != null ? tcDto.getInputData() : "")
                            .expectedOutput(tcDto.getExpectedOutput() != null ? tcDto.getExpectedOutput() : "")
                            .isHidden(Boolean.TRUE.equals(tcDto.getIsHidden()))
                            .problem(problem)
                            .build()
            ).collect(Collectors.toList());
            problem.getTestCases().addAll(testCases);
        }

        problemRepository.save(problem);
        return ResponseEntity.ok(Map.of(
                "message", "Problem created successfully",
                "problemId", problem.getProblemId()
        ));
    }

    @Transactional
    @GetMapping
    public ResponseEntity<?> getProblems(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String difficulty) {

        String token = authHeader.substring(7);
        Claims claims = jwtService.parseToken(token);
        String role = claims.get("role", String.class);
        UUID userId = UUID.fromString(claims.getSubject());
        int safeSize = Math.min(size, 50);

        if ("STUDENT".equals(role)) {
            String normalizedSearch = (search != null && !search.isBlank())
                    ? "%" + search.trim().toLowerCase() + "%" : null;
            Problem.DifficultyLevel diffEnum = parseDifficulty(difficulty);
            Pageable pageable = PageRequest.of(page, safeSize, Sort.by("title").ascending());
            Page<Problem> problems = problemRepository.searchPublicProblems(normalizedSearch, diffEnum, pageable);
            Set<UUID> solvedIds = submissionRepository.findSolvedProblemIds(userId);
            Page<ProblemBrowseDTO> result = problems.map(p -> {
                String authorName = p.getCreatedBy() != null ? "Prof. " + p.getCreatedBy().getLastName() : "PSP Platform";
                return new ProblemBrowseDTO(
                        p.getProblemId(),
                        p.getTitle(),
                        p.getDifficultyLevel().name(),
                        0.0,
                        0,
                        0,
                        solvedIds.contains(p.getProblemId()),
                        authorName
                );
            });
            return ResponseEntity.ok(result);
        }

        // TEACHER / ADMIN — paginated list of all problems, newest first
        Pageable pageable = PageRequest.of(page, safeSize, Sort.by("createdAt").descending());
        Page<Problem> raw = problemRepository.findAll(pageable);

        Page<Map<String, Object>> result = raw.map(p -> {
            List<Map<String, Object>> tcList = p.getTestCases().stream().map(tc -> {
                Map<String, Object> tc2 = new java.util.LinkedHashMap<>();
                tc2.put("testCaseId", tc.getTestCaseId());
                tc2.put("inputData", tc.getInputData());
                tc2.put("expectedOutput", tc.getExpectedOutput());
                tc2.put("isHidden", Boolean.TRUE.equals(tc.getIsHidden()));
                return tc2;
            }).collect(Collectors.toList());

            Map<String, Object> dto = new java.util.LinkedHashMap<>();
            dto.put("problemId",     p.getProblemId());
            dto.put("title",         p.getTitle());
            dto.put("description",   p.getDescription());
            dto.put("difficultyLevel", p.getDifficultyLevel().name());
            dto.put("isPublic",      Boolean.TRUE.equals(p.getIsPublic()));
            dto.put("timeLimitMs",   p.getTimeLimitMs());
            dto.put("memoryLimitMb", p.getMemoryLimitMb());
            dto.put("category",      p.getCategory());
            dto.put("tags",          new ArrayList<>(p.getTags()));
            dto.put("hints",         new ArrayList<>(p.getHints()));
            dto.put("testCases",     tcList);
            dto.put("createdAt",     p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
            return dto;
        });
        return ResponseEntity.ok(result);
    }

    @Transactional
    @GetMapping("/{id}")
    public ResponseEntity<?> getProblemById(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID userId = UUID.fromString(jwtService.parseToken(token).getSubject());

        Optional<Problem> opt = problemRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Problem problem = opt.get();

        Set<UUID> solvedIds = submissionRepository.findSolvedProblemIds(userId);

        List<ProblemDetailDTO.VisibleTestCaseDTO> visible = problem.getTestCases().stream()
                .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                .map(tc -> new ProblemDetailDTO.VisibleTestCaseDTO(
                        tc.getTestCaseId(), tc.getInputData(), tc.getExpectedOutput()))
                .collect(Collectors.toList());

        int hiddenCount = (int) problem.getTestCases().stream()
                .filter(tc -> Boolean.TRUE.equals(tc.getIsHidden()))
                .count();

        long total    = submissionRepository.countByProblem_ProblemId(problem.getProblemId());
        long accepted = submissionRepository.countByProblem_ProblemIdAndIsAcceptedTrue(problem.getProblemId());
        double rate   = total > 0 ? (double) accepted / total * 100 : 0.0;

        String authorName = problem.getCreatedBy() != null ? "Prof. " + problem.getCreatedBy().getLastName() : "PSP Platform";

        return ResponseEntity.ok(new ProblemDetailDTO(
                problem.getProblemId(),
                problem.getTitle(),
                problem.getDescription(),
                problem.getDifficultyLevel().name(),
                problem.getTimeLimitMs(),
                problem.getMemoryLimitMb(),
                solvedIds.contains(problem.getProblemId()),
                visible,
                hiddenCount,
                problem.getTags() != null ? new ArrayList<>(problem.getTags()) : List.of(),
                (int) total,
                (int) accepted,
                rate,
                authorName,
                problem.getCategory(),
                problem.getHints() != null ? new ArrayList<>(problem.getHints()) : List.of()
        ));
    }

    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<?> updateProblem(
            @PathVariable UUID id,
            @RequestBody UpdateProblemDTO dto,
            @RequestHeader("Authorization") String authHeader) {

        Optional<Problem> opt = problemRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Problem problem = opt.get();

        if (dto.getTitle() != null)       problem.setTitle(dto.getTitle());
        if (dto.getDescription() != null) problem.setDescription(dto.getDescription());
        if (dto.getDifficultyLevel() != null)
            problem.setDifficultyLevel(Problem.DifficultyLevel.valueOf(dto.getDifficultyLevel().toUpperCase()));
        if (dto.getIsPublic() != null)     problem.setIsPublic(dto.getIsPublic());
        if (dto.getTimeLimitMs() != null)  problem.setTimeLimitMs(dto.getTimeLimitMs());
        if (dto.getMemoryLimitMb() != null) problem.setMemoryLimitMb(dto.getMemoryLimitMb());
        if (dto.getTags() != null)         { problem.getTags().clear(); problem.getTags().addAll(dto.getTags()); }
        if (dto.getCategory() != null)     problem.setCategory(dto.getCategory());
        if (dto.getHints() != null)        { problem.getHints().clear(); problem.getHints().addAll(dto.getHints()); }

        if (dto.getTestCases() != null) {
            problem.getTestCases().clear();
            List<TestCase> newCases = dto.getTestCases().stream().map(tcDto ->
                TestCase.builder()
                    .inputData(tcDto.getInputData())
                    .expectedOutput(tcDto.getExpectedOutput())
                    .isHidden(tcDto.getIsHidden() != null ? tcDto.getIsHidden() : false)
                    .problem(problem)
                    .build()
            ).collect(Collectors.toList());
            problem.getTestCases().addAll(newCases);
        }

        problemRepository.save(problem);
        return ResponseEntity.ok(Map.of("message", "Problem updated", "problemId", problem.getProblemId()));
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProblem(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String authHeader) {

        if (!problemRepository.existsById(id)) return ResponseEntity.notFound().build();
        problemRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Problem deleted"));
    }

    @Transactional
    @PatchMapping("/{id}/visibility")
    public ResponseEntity<?> toggleVisibility(
            @PathVariable UUID id,
            @RequestBody Map<String, Boolean> body,
            @RequestHeader("Authorization") String authHeader) {

        Optional<Problem> opt = problemRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Problem problem = opt.get();
        Boolean isPublic = body.get("isPublic");
        if (isPublic != null) problem.setIsPublic(isPublic);
        problemRepository.save(problem);
        return ResponseEntity.ok(Map.of("message", "Visibility updated", "isPublic", problem.getIsPublic()));
    }

    @Transactional
    @GetMapping("/picker")
    public ResponseEntity<?> getProblemsForPicker(
            @RequestParam(name = "for", required = false) String forScope,
            @RequestHeader("Authorization") String authHeader) {

        UUID callerId = UUID.fromString(jwtService.parseToken(authHeader.substring(7)).getSubject());

        // Scoped picker (TP/exam builder): GLOBAL problems, problems flagged for
        // this exact scope, plus the caller's own PRIVATE problems. No `for` param
        // (legacy/unscoped callers) keeps the old behavior of showing everything.
        Problem.ProblemVisibility scoped = "TP".equalsIgnoreCase(forScope) ? Problem.ProblemVisibility.TP_ONLY
                : "EXAM".equalsIgnoreCase(forScope) ? Problem.ProblemVisibility.EXAM_ONLY
                : null;

        List<Map<String, Object>> result = problemRepository.findAll().stream()
                .filter(p -> scoped == null
                        || p.getVisibility() == Problem.ProblemVisibility.GLOBAL
                        || p.getVisibility() == scoped
                        || (p.getCreatedBy() != null && callerId.equals(p.getCreatedBy().getId())))
                .map(p -> Map.<String, Object>of(
                        "problemId", p.getProblemId(),
                        "title", p.getTitle(),
                        "difficulty", p.getDifficultyLevel().name(),
                        "isPublic", Boolean.TRUE.equals(p.getIsPublic()),
                        "visibility", p.getVisibility().name()
                ))
                .toList();
        return ResponseEntity.ok(result);
    }

    @Transactional
    @GetMapping("/{id}/my-submissions")
    public ResponseEntity<?> getMySubmissions(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID assessmentId,
            @RequestParam(required = false) UUID competitionId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.substring(7);
        UUID userId  = UUID.fromString(jwtService.parseToken(token).getSubject());

        Pageable pageable = PageRequest.of(0, 20, Sort.by("timestamp").descending());
        // Optional scope: the TP/exam/CP "My Submissions" tab shows only attempts
        // made inside that assessment/competition, not the student's whole
        // practice history.
        List<com.university.platform.execution.model.Submission> subs =
                assessmentId != null ? submissionRepository.findMySubmissionsForProblemInAssessment(userId, id, assessmentId, pageable)
                : competitionId != null ? submissionRepository.findMySubmissionsForProblemInCompetition(userId, id, competitionId, pageable)
                : submissionRepository.findMySubmissionsForProblem(userId, id, pageable);

        // Result.pointsAwarded is a generic practice-gamification score
        // (EASY=10/MEDIUM=20/HARD=30, unrelated to any assessment/competition) —
        // inside a scoped "My Submissions" tab that number is meaningless next to
        // the overview page's real score. Substitute the actual point value for
        // this problem in this context instead.
        Integer assessmentMaxPoints =
                assessmentId != null ? assessmentProblemRepository.findByAssessment_AssessmentIdAndProblem_ProblemId(assessmentId, id)
                        .map(AssessmentProblem::effectiveMaxPoints).orElse(null)
                : competitionId != null ? competitionProblemRepository.findByCompetitionIdAndProblem_ProblemId(competitionId, id)
                        .map(com.university.platform.competition.model.CompetitionProblem::getPoints).orElse(null)
                : null;

        // CP uses the AC/WA/TLE vocabulary (competition_submissions.verdict);
        // everything else (practice, TP, exam) uses the same PASS/FAIL/...
        // vocabulary as results.status — this tab must not always speak CP,
        // even though it's shared across all three arena types.
        boolean cpVocabulary = competitionId != null;

        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> result = subs.stream().map(s -> {
            com.university.platform.execution.model.Result r = s.getResult();
            String status;
            long   timeMs    = 0;
            long   memoryKb  = 0;
            String passStatus = cpVocabulary ? "ACCEPTED" : "PASS";

            if (Boolean.TRUE.equals(s.getIsAccepted())) {
                status = passStatus;
            } else if (r != null) {
                status = cpVocabulary
                        ? switch (r.getStatus()) {
                            case PASS       -> "ACCEPTED";
                            case FAIL       -> "WRONG_ANSWER";
                            case TIME_OUT   -> "TIME_LIMIT_EXCEEDED";
                            case ERROR      -> "RUNTIME_ERROR";
                            case MEMORY_OUT -> "MEMORY_LIMIT_EXCEEDED";
                        }
                        : r.getStatus().name(); // PASS / FAIL / TIME_OUT / ERROR / MEMORY_OUT
            } else {
                status = s.getStatus() == com.university.platform.execution.model.Submission.SubmissionStatus.PENDING
                        ? "PENDING" : (cpVocabulary ? "COMPILATION_ERROR" : "ERROR");
            }

            if (r != null) {
                timeMs   = r.getExecutionTimeMs()  != null ? r.getExecutionTimeMs()  : 0;
                memoryKb = r.getMemoryUsedMb()      != null ? r.getMemoryUsedMb() * 1024L : 0;
            }

            int score = assessmentMaxPoints != null
                    ? (passStatus.equals(status) ? assessmentMaxPoints : 0)
                    : (r != null ? r.getPointsAwarded().intValue() : 0);

            return Map.<String, Object>of(
                    "id",          s.getSubmissionId(),
                    "status",      status,
                    "language",    s.getLanguage().name(),
                    "score",       score,
                    "timeMs",      timeMs,
                    "memoryKb",    memoryKb,
                    "submittedAt", s.getTimestamp().toString(),
                    "submittedAgo", timeAgo(s.getTimestamp(), now)
            );
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    private String timeAgo(LocalDateTime past, LocalDateTime now) {
        long minutes = ChronoUnit.MINUTES.between(past, now);
        if (minutes < 1)   return "just now";
        if (minutes < 60)  return minutes + " min ago";
        long hours = ChronoUnit.HOURS.between(past, now);
        if (hours < 24)    return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
        long days = ChronoUnit.DAYS.between(past, now);
        if (days < 30)     return days + " day" + (days > 1 ? "s" : "") + " ago";
        long months = ChronoUnit.MONTHS.between(past, now);
        return months + " month" + (months > 1 ? "s" : "") + " ago";
    }

    @PostMapping("/{id}/run")
    @Transactional
    public ResponseEntity<?> runCode(
            @PathVariable UUID id,
            @Valid @RequestBody RunRequestDTO dto,
            @RequestHeader("Authorization") String authHeader) {

        Optional<Problem> opt = problemRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Problem problem = opt.get();

        List<TestCase> visibleCases = problem.getTestCases().stream()
                .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                .collect(Collectors.toList());

        if (visibleCases.isEmpty()) {
            return ResponseEntity.ok(RunResultDTO.builder()
                    .status("ALL_PASSED").results(List.of()).totalCases(0).build());
        }

        List<DockerService.TestCasePair> pairs = visibleCases.stream()
                .map(tc -> new DockerService.TestCasePair(tc.getInputData(), tc.getExpectedOutput()))
                .collect(Collectors.toList());

        try {
            List<DockerService.TestCaseResult> dockerResults = dockerService.executeWithTestCases(
                    dto.getSourceCode(),
                    dto.getLanguage(),
                    pairs,
                    problem.getTimeLimitMs(),
                    problem.getMemoryLimitMb()
            );

            // Detect compilation error: all cases have ERROR status with 0 ms
            boolean isCompileError = !dockerResults.isEmpty()
                    && dockerResults.stream().allMatch(r ->
                            r.status() == com.university.platform.execution.model.Result.ResultStatus.ERROR
                            && r.executionTimeMs() == 0);
            if (isCompileError) {
                return ResponseEntity.ok(RunResultDTO.compilationError(dockerResults.get(0).actualOutput()));
            }

            // Build results with early-termination metadata
            List<RunResultDTO.TestCaseResult> results = new ArrayList<>();
            Integer stoppedAt = null;
            String  failReason = null;

            for (int i = 0; i < dockerResults.size(); i++) {
                DockerService.TestCaseResult r  = dockerResults.get(i);
                TestCase                     tc = visibleCases.get(i);

                String verdict = switch (r.status()) {
                    case PASS       -> "ACCEPTED";
                    case FAIL       -> "WRONG_ANSWER";
                    case TIME_OUT   -> "TIME_LIMIT_EXCEEDED";
                    case ERROR      -> "RUNTIME_ERROR";
                    case MEMORY_OUT -> "MEMORY_LIMIT_EXCEEDED";
                };

                results.add(RunResultDTO.TestCaseResult.builder()
                        .index(i + 1)
                        .passed(r.passed())
                        .verdict(verdict)
                        .input(tc.getInputData())
                        .expectedOutput(tc.getExpectedOutput())
                        .actualOutput(truncate(r.actualOutput(), 500))
                        .timeMs(r.executionTimeMs())
                        .isHidden(false)
                        .build());

                if (!r.passed() && stoppedAt == null) {
                    stoppedAt  = i + 1;
                    failReason = verdict;
                }
            }

            return ResponseEntity.ok(RunResultDTO.builder()
                    .status(stoppedAt == null ? "ALL_PASSED" : "FAILED")
                    .results(results)
                    .stoppedAt(stoppedAt)
                    .totalCases(visibleCases.size())
                    .failReason(failReason)
                    .build());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Execution failed: " + e.getMessage()));
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    private Problem.DifficultyLevel parseDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) return null;
        try {
            return Problem.DifficultyLevel.valueOf(difficulty.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
