package com.university.platform.assessment.dto;

import java.util.UUID;

public record ProblemBrowseDTO(
    UUID problemId,
    String title,
    String difficulty,
    double passRate,
    int submissionCount,
    int points,
    boolean solvedByCurrentUser,
    String authorName
) {}
