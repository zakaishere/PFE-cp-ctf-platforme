package com.university.platform.execution.dto;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;

import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SubmissionRequestDTO {

    @NotNull(message = "studentId is required")
    private UUID studentId;

    @NotNull(message = "problemId is required")
    private UUID problemId;

    private UUID assessmentId;

    private String accessCode;

    @NotBlank(message = "sourceCode must not be blank")
    private String sourceCode;

    @NotNull(message = "language is required")
    private ProgrammingLanguage language;

    private boolean runOnly;
}
