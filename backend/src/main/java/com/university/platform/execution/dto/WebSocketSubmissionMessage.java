package com.university.platform.execution.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public class WebSocketSubmissionMessage {

    /**
     * Sent after each individual test case finishes.
     * inputData / expectedOutput are null for hidden test cases.
     */
    public record TestCaseResultMessage(
            String type,            // always "TEST_CASE_RESULT"
            UUID   submissionId,
            int    testCaseIndex,   // 0-based
            UUID   testCaseId,
            String status,
            long   executionTimeMs,
            String actualOutput,    // always present
            String inputData,       // null for hidden test cases
            String expectedOutput,  // null for hidden test cases
            @JsonProperty("isHidden") boolean isHidden
    ) {}

    /**
     * Sent once after all test cases finish (or immediately on COMPILATION_ERROR).
     */
    public record SubmissionCompleteMessage(
            String type,           // always "SUBMISSION_COMPLETE"
            UUID   submissionId,
            int    totalPassed,
            int    totalFailed,
            int    totalTestCases,
            String finalStatus,    // ACCEPTED | WRONG_ANSWER | RUNTIME_ERROR | TIME_OUT | MEMORY_LIMIT_EXCEEDED | COMPILATION_ERROR
            String errorMessage    // non-null only for COMPILATION_ERROR; contains compiler output
    ) {}
}
