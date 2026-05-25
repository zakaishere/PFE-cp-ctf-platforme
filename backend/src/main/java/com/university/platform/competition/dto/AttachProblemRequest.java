package com.university.platform.competition.dto;

import lombok.Data;

@Data
public class AttachProblemRequest {
    private Integer points; // null → use difficulty default
}
