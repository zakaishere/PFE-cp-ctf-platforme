package com.university.platform.assessment.dto;
import com.university.platform.assessment.VisibilityMode;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.identity.model.Cohort;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class CreateAssessmentDTO {

    private String title;
    private String description;

    private UUID moduleId;

    private LocalDateTime scheduledStartTime;
    private Integer durationMinutes;
    private String strictAccessCode;

    private LocalDateTime deadline;
    private Integer maxAttempts;

    private Boolean isPenaltyEnabled;

    private VisibilityMode visibilityMode;
}
