package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

public record ExamProblemDTO(
    UUID problemId,
    String label,
    String title,
    String difficulty,
    int timeLimitMs,
    int memoryLimitMb,
    String description,
    int points,
    List<VisibleTestCaseDTO> visibleTestCases,
    int hiddenTestCaseCount,
    boolean solvedByCurrentUser,
    /** Attempts this student has spent on this problem. Populated for TPs; null otherwise. */
    Integer attemptsUsed
) {
    public record VisibleTestCaseDTO(UUID id, String input, String expectedOutput) {}
}
