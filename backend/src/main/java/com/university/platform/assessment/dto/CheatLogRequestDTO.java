package com.university.platform.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CheatLogRequestDTO {
    @NotNull
    private UUID studentId;
    @NotNull
    private UUID assessmentId;
    @NotBlank
    private String violationType;
}
