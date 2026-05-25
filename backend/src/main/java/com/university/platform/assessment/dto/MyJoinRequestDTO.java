package com.university.platform.assessment.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class MyJoinRequestDTO {
    private UUID requestId;
    private UUID targetId;
    private String targetTitle;
    private String targetType;          // "LIVE_EXAM" | "OPEN_TP" | "COMPETITION"
    private String targetStatus;        // e.g. "OPEN" / "CLOSED" / "REGISTRATION" / "ACTIVE" / "ENDED"
    private LocalDateTime startTime;    // exam or competition start; null for OpenTP
    private LocalDateTime deadline;     // OpenTP deadline; null for others
    private String myRequestStatus;     // "PENDING" | "APPROVED" | "REJECTED"
    private String rejectionReason;
    private LocalDateTime requestedAt;
    private LocalDateTime decidedAt;
}
