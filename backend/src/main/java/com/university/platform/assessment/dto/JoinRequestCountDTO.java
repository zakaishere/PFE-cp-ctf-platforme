package com.university.platform.assessment.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class JoinRequestCountDTO {
    private long pending;
    private long approved;
    private long rejected;
    private long total;
}
