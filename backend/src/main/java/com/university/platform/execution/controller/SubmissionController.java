package com.university.platform.execution.controller;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;

import com.university.platform.execution.dto.SubmissionRequestDTO;
import com.university.platform.execution.dto.SubmissionResponseDTO;
import com.university.platform.execution.repository.ResultRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.execution.service.SubmissionService;
import com.university.platform.identity.service.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService    submissionService;
    private final ResultRepository     resultRepository;
    private final SubmissionRepository submissionRepository;
    private final JwtService           jwtService;

    @PostMapping
    public ResponseEntity<SubmissionResponseDTO> submit(
            @Valid @RequestBody SubmissionRequestDTO request) {

        log.info("[API] POST /api/submissions — student={} problem={} lang={}",
                request.getStudentId(), request.getProblemId(), request.getLanguage());

        SubmissionResponseDTO response = submissionService.submit(request);

        return ResponseEntity
                .status(HttpStatus.ACCEPTED)
                .body(response);
    }

    @GetMapping("/{submissionId}/code")
    public ResponseEntity<?> getSubmissionCode(
            @PathVariable UUID submissionId,
            @RequestHeader("Authorization") String authHeader) {

        String token     = authHeader.substring(7);
        UUID   studentId = UUID.fromString(jwtService.parseToken(token).getSubject());

        return submissionRepository.findById(submissionId)
                .map(sub -> {
                    if (!sub.getStudent().getId().equals(studentId)) {
                        return ResponseEntity.status(403).<Map<String, String>>body(
                                Map.of("error", "Not your submission"));
                    }
                    return ResponseEntity.ok(Map.of(
                            "code",     sub.getSourceCode(),
                            "language", sub.getLanguage().name()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{submissionId}/result")
    public ResponseEntity<?> getResult(@PathVariable UUID submissionId) {
        return resultRepository.findBySubmission_SubmissionId(submissionId)
                .map(r -> ResponseEntity.ok(Map.of(
                        "status",          r.getStatus().name(),
                        "executionTimeMs", r.getExecutionTimeMs() != null ? r.getExecutionTimeMs() : 0,
                        "memoryUsedMb",    r.getMemoryUsedMb()   != null ? r.getMemoryUsedMb()   : 0,
                        "pointsAwarded",   r.getPointsAwarded(),
                        "feedback",        r.getFeedback() != null ? r.getFeedback() : ""
                )))
                .orElse(ResponseEntity.status(HttpStatus.ACCEPTED)
                        .body(Map.of("status", "PENDING")));
    }
}

