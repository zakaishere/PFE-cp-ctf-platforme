package com.university.platform.execution.dto;

import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RunRequestDTO {

    @NotBlank(message = "sourceCode must not be blank")
    private String sourceCode;

    @NotNull(message = "language is required")
    private ProgrammingLanguage language;
}
