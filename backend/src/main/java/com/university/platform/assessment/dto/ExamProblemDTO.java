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
    Integer attemptsUsed,
    /** Points this student has earned on this problem after the assessment's
     *  scoring mode / penalty is applied (from exam_attempt_results). Populated
     *  for TPs so the overview/results pages can show per-task scores; null for
     *  live exams (scores stay hidden until grades are released). */
    Integer earnedScore
) {
    public record VisibleTestCaseDTO(UUID id, String input, String expectedOutput) {}
}
