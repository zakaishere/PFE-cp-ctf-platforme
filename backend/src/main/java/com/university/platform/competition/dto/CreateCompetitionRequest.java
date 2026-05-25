package com.university.platform.competition.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.university.platform.assessment.VisibilityMode;
import com.university.platform.competition.model.Competition.CompetitionMode;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateCompetitionRequest {
    private String title;
    private String description;
    @JsonProperty("scheduledStartTime")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm")
    private LocalDateTime startTime;
    private int durationMinutes;
    private CompetitionMode mode;
    private int maxTeamSize = 1;
    private Boolean isPublic = true;
    private VisibilityMode visibilityMode;
}
