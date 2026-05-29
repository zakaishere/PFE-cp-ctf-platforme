package com.university.platform.runtime;

import com.university.platform.execution.service.DockerService.TestCasePair;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;

import java.util.List;

/** One-shot execution input. Mirrors the existing DockerService.executeWithTestCases signature. */
public record EphemeralRunSpec(
        String sourceCode,
        ProgrammingLanguage language,
        List<TestCasePair> testCases,
        int timeLimitMs,
        int memoryLimitMb
) {}
