package com.university.platform.competition.dto;

import com.university.platform.assessment.VisibilityMode;
import com.university.platform.competition.model.Competition.CompetitionMode;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class CompetitionSummaryDTO {
    private UUID competitionId;
    private String title;
    private String creatorName;
    private CompetitionMode mode;
    private CompetitionStatus status;
    private LocalDateTime startTime;
    private int durationMinutes;
    private int problemCount;
    private int participantCount;
    private int registeredCount;
    private Integer minTeamSize;
    private Integer maxTeamSize;
    private VisibilityMode visibilityMode;
    private String myJoinStatus;
    private UUID myTeamId;
    private Integer pendingRequestCount;
}
