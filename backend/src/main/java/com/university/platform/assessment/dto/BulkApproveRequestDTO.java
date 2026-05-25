package com.university.platform.assessment.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class BulkApproveRequestDTO {
    private List<UUID> requestIds;
}
