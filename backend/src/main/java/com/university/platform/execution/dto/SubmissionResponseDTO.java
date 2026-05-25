package com.university.platform.execution.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class SubmissionResponseDTO {

    private UUID   submissionId;
    private String status;          
    private String message;         
}
