package com.university.platform.competition.dto;

import com.university.platform.competition.model.Competition.CompetitionMode;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ArenaDTO {
    private UUID competitionId;
    private String title;
    private CompetitionMode mode;
    private LocalDateTime endTime;
    private long remainingSeconds;
    private boolean penaltyEnabled;
    private Integer penaltyMinutes;
    private List<ArenaProblemDTO> problems;
    private TeamDetailDTO myTeam;

    @Data
    @Builder
    public static class ArenaProblemDTO {
        private UUID problemId;
        private String label;
        private String title;
        private String description;
        private String difficultyLevel;
        private int points;
        private int timeLimitMs;
        private int memoryLimitMb;
        private List<VisibleTestCaseDTO> visibleTestCases;
        private int hiddenTestCaseCount;
        private String solveStatus; // UNSOLVED | ATTEMPTED | SOLVED
        private int attempts;
        private Integer score;
    }

    @Data
    @Builder
    public static class VisibleTestCaseDTO {
        private UUID testCaseId;
        private String input;
        private String expectedOutput;
    }
}
