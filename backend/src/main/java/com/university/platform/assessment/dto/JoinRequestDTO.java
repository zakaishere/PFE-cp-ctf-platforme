package com.university.platform.assessment.dto;

import com.university.platform.assessment.JoinRequestStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class JoinRequestDTO {
    private UUID requestId;
    private UUID studentId;
    private String firstName;
    private String lastName;
    private String email;
    private String apogeeNumber;
    private String divisionName;
    private String semesterName;
    private String message;
    private JoinRequestStatus status;
    private String rejectionReason;
    private LocalDateTime requestedAt;
    private LocalDateTime decidedAt;
}
