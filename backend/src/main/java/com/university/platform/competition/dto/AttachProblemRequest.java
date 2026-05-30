package com.university.platform.competition.dto;

import lombok.Data;

@Data
public class AttachProblemRequest {
    private Integer points; // null → use difficulty default

    // Per-problem scoring config (migration v22). All optional; sensible
    // defaults applied when null.
    private Integer maxPoints;                 // defaults to `points`
    private Integer minPoints;                 // RATED floor (default 0)
    private java.math.BigDecimal decayPerMin;  // RATED decay (default 1.0)
    private Integer wrongPenalty;              // ICPC/RATED wrong penalty (default 20)
}
