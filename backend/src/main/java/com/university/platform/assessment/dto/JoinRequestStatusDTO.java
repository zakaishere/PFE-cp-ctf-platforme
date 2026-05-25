package com.university.platform.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JoinRequestStatusDTO {
    private String status;
    private String rejectionReason;
}
