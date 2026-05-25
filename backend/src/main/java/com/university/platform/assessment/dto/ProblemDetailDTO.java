package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

public record ProblemDetailDTO(
    UUID   problemId,
    String title,
    String description,
    String difficulty,
    int    timeLimitMs,
    int    memoryLimitMb,
    boolean solvedByCurrentUser,
    List<VisibleTestCaseDTO> visibleTestCases,
    int    hiddenTestCaseCount,
    List<String> tags,
    int    totalSubmissions,
    int    acceptedSubmissions,
    double acceptanceRate,
    String authorName,
    String category,
    List<String> hints
) {
    public record VisibleTestCaseDTO(
        UUID   id,
        String input,
        String expectedOutput
    ) {}
}
