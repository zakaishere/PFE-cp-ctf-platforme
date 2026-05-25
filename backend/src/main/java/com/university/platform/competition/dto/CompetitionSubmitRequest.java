package com.university.platform.competition.dto;

import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import lombok.Data;

import java.util.UUID;

@Data
public class CompetitionSubmitRequest {
    private UUID problemId;
    private String sourceCode;
    private ProgrammingLanguage language;
}
