package com.university.platform.competition.dto;

import com.university.platform.competition.model.CompetitionSubmission.Verdict;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class SoloScoreboardEntryDTO {
    private int rank;
    private UUID studentId;
    private String firstName;
    private String lastName;
    private int totalScore;
    private int solvedCount;
    private LocalDateTime lastSolveTime;
    private List<ProblemResult> problems;

    @Data
    @Builder
    public static class ProblemResult {
        private String label;
        private Verdict verdict;
        private int score;
        private int attempts;
        private LocalDateTime solvedAt;
    }
}
