package com.university.platform.execution.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RunResultDTO {

    /** ALL_PASSED | FAILED | COMPILATION_ERROR */
    private String status;

    private List<TestCaseResult> results;

    /** 1-based index of first failed test case; null when all passed */
    private Integer stoppedAt;

    private int totalCases;

    /** WRONG_ANSWER | TIME_LIMIT_EXCEEDED | RUNTIME_ERROR | MEMORY_LIMIT_EXCEEDED */
    private String failReason;

    /** Compiler error output — only present when status = COMPILATION_ERROR */
    private String compileError;

    public static RunResultDTO compilationError(String error) {
        return RunResultDTO.builder()
                .status("COMPILATION_ERROR")
                .compileError(error)
                .results(List.of())
                .totalCases(0)
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestCaseResult {
        private int     index;
        private boolean passed;
        /** ACCEPTED | WRONG_ANSWER | TIME_LIMIT_EXCEEDED | RUNTIME_ERROR | MEMORY_LIMIT_EXCEEDED */
        private String  verdict;
        private String  input;
        private String  expectedOutput;
        /** Truncated to 500 chars */
        private String  actualOutput;
        private long    timeMs;
        private boolean isHidden;
    }
}
