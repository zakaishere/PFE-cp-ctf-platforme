package com.university.platform.execution.service;

import com.university.platform.assessment.model.TestCase;
import com.university.platform.assessment.repository.TestCaseRepository;
import com.university.platform.competition.service.CompetitionScoringService;
import com.university.platform.config.RabbitMQConfig;
import com.university.platform.execution.dto.WebSocketSubmissionMessage.SubmissionCompleteMessage;
import com.university.platform.execution.dto.WebSocketSubmissionMessage.TestCaseResultMessage;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import com.university.platform.execution.model.SubmissionJobMessage;
import com.university.platform.execution.repository.ResultRepository;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.execution.service.DockerService.TestCasePair;
import com.university.platform.execution.service.DockerService.TestCaseResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionWorkerService {

    private final SubmissionRepository submissionRepository;
    private final ResultRepository resultRepository;
    private final TestCaseRepository testCaseRepository;
    private final DockerService dockerService;
    private final SimpMessagingTemplate messagingTemplate;
    private final CompetitionScoringService competitionScoringService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    @Transactional
    public void handleSubmissionJob(SubmissionJobMessage message) {

        UUID submissionId = message.getSubmissionId();
        log.info("[WORKER] Received job for submission {}", submissionId);

        Submission submission = submissionRepository.findById(submissionId).orElse(null);
        if (submission == null) {
            // Stale message (submission was deleted or from a previous DB) — ACK and discard
            log.warn("[WORKER] Submission {} not found in DB, discarding stale message", submissionId);
            return;
        }

        try {
            List<TestCase> testCases =
                    testCaseRepository.findByProblem_ProblemId(message.getProblemId());

            if (submission.isPlanningMode()) {
                testCases = testCases.stream()
                        .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                        .toList();
            }

            if (testCases.isEmpty()) {
                log.warn("[WORKER] No test cases found for problem {}", message.getProblemId());
            }

            List<TestCasePair> pairs = testCases.stream()
                    .map(tc -> new TestCasePair(tc.getInputData(), tc.getExpectedOutput()))
                    .toList();

            log.info("[WORKER] Starting Docker execution: {} test cases, lang={}, timeLimit={}ms",
                    pairs.size(), message.getLanguage(), message.getTimeLimitMs());

            List<TestCaseResult> results = dockerService.executeWithTestCases(
                    message.getSourceCode(),
                    message.getLanguage(),
                    pairs,
                    message.getTimeLimitMs(),
                    message.getMemoryLimitMb()
            );

            // Detect compilation error: all cases have ERROR status with 0 ms (no case ran)
            boolean isCompilationError = !results.isEmpty()
                    && results.stream().allMatch(r -> r.status() == ResultStatus.ERROR && r.executionTimeMs() == 0);

            if (isCompilationError) {
                String feedback = results.get(0).actualOutput();
                Result errorResult = Result.builder()
                        .status(ResultStatus.ERROR)
                        .executionTimeMs(0)
                        .memoryUsedMb(message.getMemoryLimitMb())
                        .pointsAwarded(0.0)
                        .feedback(feedback)
                        .submission(submission)
                        .build();
                resultRepository.save(errorResult);
                log.info("[WORKER] Compilation error for submission {}", submissionId);

                submission.setStatus(SubmissionStatus.COMPLETED);
                submissionRepository.save(submission);

                if (submission.getCompetitionId() != null) {
                    competitionScoringService.processResult(submission, errorResult);
                }
                pushSubmissionComplete(submissionId, 0, results.size(), results.size(), "COMPILATION_ERROR", feedback);
                return;
            }

            // Push TEST_CASE_RESULT messages — stop after the first failure (early termination).
            // The Docker batch already ran all cases, but we only surface results up to the first failure
            // so the student sees exactly where they failed without information about later cases.
            for (int i = 0; i < results.size(); i++) {
                TestCaseResult tcr = results.get(i);
                TestCase       tc  = testCases.get(i);
                boolean hidden = Boolean.TRUE.equals(tc.getIsHidden());
                pushTestCaseResult(
                        submissionId, i, tc.getTestCaseId(),
                        tcr.status().name(), tcr.executionTimeMs(),
                        tcr.actualOutput(),
                        hidden ? null : tcr.inputData(),
                        hidden ? null : tcr.expectedOutput(),
                        hidden);
                if (!tcr.passed()) {
                    log.info("[WORKER] Early-stop WS push at test case {}/{} for submission {}",
                            i + 1, results.size(), submissionId);
                    break;
                }
            }

            AggregateMetrics metrics = aggregate(results);

            // Scoring — kept after the test-case loop, before SUBMISSION_COMPLETE
            double pointsToAward = 0.0;
            if (metrics.overallStatus() == ResultStatus.PASS && !submission.isPlanningMode()) {
                boolean alreadyPassed = resultRepository.existsBySubmission_Student_IdAndSubmission_Problem_ProblemIdAndStatus(
                        message.getStudentId(), message.getProblemId(), ResultStatus.PASS);
                if (!alreadyPassed) {
                    var difficulty = submission.getProblem().getDifficultyLevel();
                    pointsToAward = switch (difficulty) {
                        case EASY -> 10.0;
                        case MEDIUM -> 20.0;
                        case HARD -> 30.0;
                        default -> 0.0;
                    };

                    if (submission.getAssessment() == null) {
                        var student = submission.getStudent();
                        student.setTotalPoints((student.getTotalPoints() == null ? 0 : student.getTotalPoints()) + (int) pointsToAward);
                    }
                }
            }

            Result result = Result.builder()
                    .status(metrics.overallStatus())
                    .executionTimeMs((int) metrics.totalTimeMs())
                    .memoryUsedMb(message.getMemoryLimitMb())
                    .pointsAwarded(pointsToAward)
                    .feedback(metrics.feedbackSummary())
                    .submission(submission)
                    .build();

            resultRepository.save(result);
            log.info("[WORKER] Result saved: {} for submission {}", metrics.overallStatus(), submissionId);

            submission.setStatus(SubmissionStatus.COMPLETED);
            if (metrics.overallStatus() == ResultStatus.PASS) {
                submission.setIsAccepted(true);
            }
            submissionRepository.save(submission);

            if (submission.getCompetitionId() != null) {
                competitionScoringService.processResult(submission, result);
            }

            int totalPassed = (int) results.stream().filter(TestCaseResult::passed).count();
            int totalFailed = results.size() - totalPassed;
            pushSubmissionComplete(submissionId, totalPassed, totalFailed, results.size(),
                    toFinalStatus(metrics.overallStatus()));

        } catch (Exception ex) {
            log.error("[WORKER] Execution failed for submission {}: {}", submissionId, ex.getMessage(), ex);

            Result errorResult = Result.builder()
                    .status(ResultStatus.ERROR)
                    .feedback("Internal execution error: " + ex.getMessage())
                    .pointsAwarded(0.0)
                    .submission(submission)
                    .build();
            resultRepository.save(errorResult);

            submission.setStatus(SubmissionStatus.COMPLETED);
            submissionRepository.save(submission);

            if (submission.getCompetitionId() != null) {
                competitionScoringService.processResult(submission, errorResult);
            }
            pushSubmissionComplete(submissionId, 0, 0, 0, "RUNTIME_ERROR");

            throw new RuntimeException("Worker execution failed", ex);
        }
    }

    // -------------------------------------------------------------------------
    // WebSocket push helpers
    // -------------------------------------------------------------------------

    private void pushTestCaseResult(UUID submissionId, int index, UUID testCaseId,
                                     String status, long executionTimeMs,
                                     String actualOutput, String inputData,
                                     String expectedOutput, boolean isHidden) {
        try {
            var msg = new TestCaseResultMessage(
                    "TEST_CASE_RESULT", submissionId, index, testCaseId,
                    status, executionTimeMs,
                    actualOutput, inputData, expectedOutput, isHidden);
            messagingTemplate.convertAndSend("/topic/submissions/" + submissionId, msg);
            log.debug("[WORKER] TEST_CASE_RESULT pushed: submission={} index={} status={}",
                    submissionId, index, status);
        } catch (Exception ex) {
            log.warn("[WORKER] Failed to push TEST_CASE_RESULT index={}: {}", index, ex.getMessage());
        }
    }

    private void pushSubmissionComplete(UUID submissionId, int totalPassed, int totalFailed,
                                         int totalTestCases, String finalStatus) {
        pushSubmissionComplete(submissionId, totalPassed, totalFailed, totalTestCases, finalStatus, null);
    }

    private void pushSubmissionComplete(UUID submissionId, int totalPassed, int totalFailed,
                                         int totalTestCases, String finalStatus, String errorMessage) {
        try {
            var msg = new SubmissionCompleteMessage(
                    "SUBMISSION_COMPLETE", submissionId, totalPassed, totalFailed, totalTestCases,
                    finalStatus, errorMessage);
            messagingTemplate.convertAndSend("/topic/submissions/" + submissionId, msg);
            log.info("[WORKER] SUBMISSION_COMPLETE pushed: submission={} finalStatus={}", submissionId, finalStatus);
        } catch (Exception ex) {
            log.warn("[WORKER] Failed to push SUBMISSION_COMPLETE: {}", ex.getMessage());
        }
    }

    private String toFinalStatus(ResultStatus status) {
        return switch (status) {
            case PASS       -> "ACCEPTED";
            case FAIL       -> "WRONG_ANSWER";
            case ERROR      -> "RUNTIME_ERROR";
            case TIME_OUT   -> "TIME_OUT";
            case MEMORY_OUT -> "MEMORY_LIMIT_EXCEEDED";
        };
    }

    // -------------------------------------------------------------------------
    // Aggregation
    // -------------------------------------------------------------------------

    private AggregateMetrics aggregate(List<TestCaseResult> results) {
        ResultStatus overall   = ResultStatus.PASS;
        long         totalMs   = 0;
        long         maxMs     = 0;
        int          failCount = 0;
        StringBuilder feedback = new StringBuilder();

        for (int i = 0; i < results.size(); i++) {
            TestCaseResult r = results.get(i);
            totalMs += r.executionTimeMs();
            if (r.executionTimeMs() > maxMs) maxMs = r.executionTimeMs();

            if (r.status().ordinal() > overall.ordinal()) {
                overall = r.status();
            }

            // Always emit per-case line (pass or fail) — Codeforces style
            String caseIcon = r.passed() ? "✓" : "✗";
            feedback.append(String.format("Case %d: %s %s · %d ms%n",
                    i + 1, caseIcon, r.status(), r.executionTimeMs()));

            if (!r.passed() && feedback.length() < 2000) {
                feedback.append(String.format("  expected [%s]%n", r.expectedOutput()));
                feedback.append(String.format("  got      [%s]%n", r.actualOutput()));
            }
        }

        // Summary line at the top (prepend)
        String summary;
        if (overall == ResultStatus.PASS) {
            summary = String.format("All %d test cases passed.%nSlowest: %d ms · Total: %d ms%n%n",
                    results.size(), maxMs, totalMs);
        } else {
            failCount = (int) results.stream().filter(r -> !r.passed()).count();
            summary = String.format("%d/%d test case(s) failed.%nSlowest: %d ms · Total: %d ms%n%n",
                    failCount, results.size(), maxMs, totalMs);
        }

        return new AggregateMetrics(overall, totalMs, summary + feedback);
    }

    private record AggregateMetrics(
            ResultStatus overallStatus,
            long         totalTimeMs,
            String       feedbackSummary
    ) {}
}
