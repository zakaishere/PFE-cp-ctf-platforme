package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

/** Per-problem, per-student score grid for a TP or Exam manage page. */
public record ScoreboardDTO(
        String assessmentTitle,
        String type,              // "OPEN_TP" | "LIVE_EXAM"
        String scoringMode,
        Integer penaltyPercent,   // TP only, null for exam
        Integer passingScore,     // exam only, null for TP
        List<ProblemDTO> problems,
        List<StudentRowDTO> students
) {
    public record ProblemDTO(UUID problemId, String title, int maxPoints) {}

    public record StudentRowDTO(
            UUID studentId,
            String fullName,
            String email,
            int totalScore,
            int totalPossible,
            int percentage,
            String status,       // PASS | FAIL (exam only) | null (TP has no threshold)
            List<CellDTO> scores
    ) {}

    public record CellDTO(
            UUID problemId,
            int earnedPoints,
            int maxPoints,
            int attemptsUsed,
            String verdict        // AC | PARTIAL | WA | null (no attempts yet)
    ) {}
}
