package com.university.platform.competition.dto;

import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CompetitionDetailDTO {
    private UUID competitionId;
    private String title;
    private String description;
    private CompetitionMode mode;
    private Integer minTeamSize;
    private Integer maxTeamSize;
    private CompetitionStatus status;
    private LocalDateTime startTime;
    private int durationMinutes;
    private boolean isPublic;
    private com.university.platform.assessment.VisibilityMode visibilityMode;
    private boolean penaltyEnabled;
    private Integer penaltyMinutes;
    private List<ProblemEntry> problems;

    @Data
    @Builder
    public static class ProblemEntry {
        private UUID problemId;
        private String label;
        private String title;
        private String difficultyLevel;
        private int points;
        private int timeLimitMs;
        private int memoryLimitMb;
    }
}
