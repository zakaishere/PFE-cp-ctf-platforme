package com.university.platform.execution.model;
import com.university.platform.execution.service.ExecutionWorkerService;
import com.university.platform.identity.model.Student;
import com.university.platform.execution.service.DockerService;
import com.university.platform.assessment.model.Problem;

import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionJobMessage {

    private UUID submissionId;

    private UUID problemId;

    private UUID studentId;

    private String sourceCode;

    private ProgrammingLanguage language;

    private Integer timeLimitMs;

    private Integer memoryLimitMb;

    private boolean runOnly;
}
