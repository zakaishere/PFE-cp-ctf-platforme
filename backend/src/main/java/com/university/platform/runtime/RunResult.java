package com.university.platform.runtime;

import com.university.platform.execution.service.DockerService.TestCaseResult;

import java.util.List;

public record RunResult(List<TestCaseResult> testCaseResults) {}
