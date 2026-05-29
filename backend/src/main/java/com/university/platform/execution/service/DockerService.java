package com.university.platform.execution.service;

import com.university.platform.execution.service.DockerService.TestCaseResult;import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.model.TestCase;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class DockerService {

    private static final int COMPILE_TIMEOUT_SEC = 30;
    private static final int EXEC_TIMEOUT_SEC    = 15;

    @Value("${execution.workdir:/dev/shm}")
    private String executionWorkDir;

    @Value("${execution.tmpfs-size-mb:100}")
    private int tmpfsSizeMb;

    @PostConstruct
    void logExecutionConfig() {
        log.info("[DOCKER] Execution work dir: {} (container /app tmpfs {}MB)",
                executionWorkDir, tmpfsSizeMb);
    }

    public record LanguageProfile(
            String fileName,
            String dockerImage,
            String compileShell,
            String runShell
    ) {}

    public LanguageProfile resolveLanguage(
            com.university.platform.execution.model.Submission.ProgrammingLanguage lang) {
        return switch (lang) {
            case PYTHON ->     new LanguageProfile(
                    "script.py",
                    "python:3.9-slim",
                    null,
                    "cp /src/script.py /app/ && python /app/script.py");

             case JAVA ->       new LanguageProfile(
                    "Main.java",
                    "eclipse-temurin:17-jdk-alpine",
                    "cp /src/Main.java /app/ && javac /app/Main.java",
                    "java -cp /app Main");
 
            case CPP ->        new LanguageProfile(
                    "main.cpp",
                    "gcc:14-bookworm",
                    "cp /src/main.cpp /app/ && g++ -O2 -o /app/app /app/main.cpp",
                    "/app/app");
 
 
            case C ->          new LanguageProfile(
                    "main.c",
                    "gcc:14-bookworm",
                    "cp /src/main.c /app/ && gcc -O2 -o /app/app /app/main.c",
                    "/app/app");
 
 
            case JAVASCRIPT -> new LanguageProfile(
                    "script.js",
                    "node:18-alpine",
                    null,
                    "cp /src/script.js /app/ && node /app/script.js");
 
            case KOTLIN ->     new LanguageProfile(
                    "Main.kt",
                    "zenika/kotlin:1.8-jdk17-alpine",
                    "cp /src/Main.kt /app/ && kotlinc /app/Main.kt -include-runtime -d /app/Main.jar",
                    "java -jar /app/Main.jar");

        };
    }

    public record TestCaseResult(
            String       inputData,
            String       expectedOutput,
            String       actualOutput,
            boolean      passed,
            ResultStatus status,
            long         executionTimeMs
    ) {}

    public record TestCasePair(String inputData, String expectedOutput) {}

    public List<TestCaseResult> executeWithTestCases(
            String sourceCode,
            com.university.platform.execution.model.Submission.ProgrammingLanguage lang,
            List<TestCasePair> testCases,
            int timeLimitMs,
            int memoryLimitMb
    ) throws IOException, InterruptedException {

        LanguageProfile profile = resolveLanguage(lang);

        String folderName = "psp_run_" + UUID.randomUUID();
        // Default: /dev/shm (RAM-disk) — fast. Override with execution.workdir when /dev/shm is too small.
        Path hostSrcPath  = Paths.get(executionWorkDir, folderName);
        Files.createDirectories(hostSrcPath);
        log.debug("[DOCKER] Created temp src dir: {}", hostSrcPath);


        List<TestCaseResult> results = new ArrayList<>();

        try {
            File sourceFile = hostSrcPath.resolve(profile.fileName()).toFile();
            try (BufferedWriter w = new BufferedWriter(new FileWriter(sourceFile))) {
                w.write(sourceCode);
            }

            // Optimization: We will run ONE container that compiles if needed and runs all test cases.
            // This is handled by runTestCaseBatch below if we were to refactor heavily, 
            // but for now let's just optimize the existing sequential loop to be slightly better.
            
            // Actually, let's implement the batch runner for real.
            return runBatch(profile, hostSrcPath, testCases, timeLimitMs, memoryLimitMb);

        } finally {

            boolean cleaned = FileSystemUtils.deleteRecursively(hostSrcPath);
            log.debug("[DOCKER] Cleanup {}: {}", hostSrcPath, cleaned ? "OK" : "FAILED");
        }
    }

    private List<TestCaseResult> runBatch(
            LanguageProfile profile,
            Path            hostSrcPath,
            List<TestCasePair> testCases,
            int             timeLimitMs,
            int             memoryLimitMb
    ) throws IOException, InterruptedException {

        List<TestCaseResult> results = new ArrayList<>();
        String memFlag = memoryLimitMb + "m";
        long perCaseTimeoutSec = (timeLimitMs / 1000) + 2; 

        // 1. Prepare input files in hostSrcPath
        for (int i = 0; i < testCases.size(); i++) {
            Path inPath = hostSrcPath.resolve("in_" + i + ".txt");
            Files.writeString(inPath, testCases.get(i).inputData() != null ? testCases.get(i).inputData() : "");
        }

        // 2. Build the shell command for the container
        StringBuilder shellCmd = new StringBuilder();
        if (profile.compileShell() != null) {
            shellCmd.append(profile.compileShell()).append(" || exit 1; ");
        }

        for (int i = 0; i < testCases.size(); i++) {
            shellCmd.append("echo '===CASE_").append(i).append("==='; ");
            // Capture nanosecond timestamp before execution for per-case timing
            shellCmd.append("_PSP_T0=$(date +%s%N); ");
            shellCmd.append("timeout ").append(perCaseTimeoutSec).append("s ")
                    .append(profile.runShell())
                    .append(" < /src/in_").append(i).append(".txt 2>&1; ");
            shellCmd.append("_PSP_EXIT=$?; ");
            shellCmd.append("_PSP_T1=$(date +%s%N); ");
            // Emit timing marker in milliseconds
            shellCmd.append("echo \"===TIME_$(( (_PSP_T1 - _PSP_T0) / 1000000 ))ms==="+"\"; ");
            shellCmd.append("echo \"\"; echo \"===EXIT_$_PSP_EXIT==="+"\"; ");
        }

        List<String> cmd = buildDockerCommand(
                profile.dockerImage(), hostSrcPath,
                memFlag, shellCmd.toString(),
                false // input is piped from files
        );

        Process proc = new ProcessBuilder(cmd)
                .redirectErrorStream(true)
                .start();

        long totalTimeoutSec = (perCaseTimeoutSec * testCases.size()) + COMPILE_TIMEOUT_SEC;
        boolean finished = proc.waitFor(totalTimeoutSec, TimeUnit.SECONDS);
        String output = readStream(proc.getInputStream());

        if (!finished) {
            proc.destroyForcibly();
            for (TestCasePair tc : testCases) {
                results.add(new TestCaseResult(tc.inputData(), tc.expectedOutput(), "Global Timeout", false, ResultStatus.TIME_OUT, 0));
            }
            return results;
        }

        // 3. Parse the output
        if (output.startsWith("Compilation failed") || (profile.compileShell() != null && !output.contains("===CASE_0==="))) {
             for (TestCasePair tc : testCases) {
                results.add(new TestCaseResult(tc.inputData(), tc.expectedOutput(), output, false, ResultStatus.ERROR, 0));
            }
            return results;
        }

        for (int i = 0; i < testCases.size(); i++) {
            String caseMarker = "===CASE_" + i + "===";
            String timeMarker = "===TIME_";
            String exitMarker = "===EXIT_";

            int caseIdx = output.indexOf(caseMarker);
            if (caseIdx == -1) {
                results.add(new TestCaseResult(testCases.get(i).inputData(), testCases.get(i).expectedOutput(),
                        "Internal Error: Case marker missing", false, ResultStatus.ERROR, 0));
                continue;
            }
            caseIdx += caseMarker.length();

            // Find ===TIME_Xms=== marker (comes before EXIT)
            int timeIdx = output.indexOf(timeMarker, caseIdx);
            int exitIdx = output.indexOf(exitMarker, caseIdx);

            if (exitIdx == -1) {
                results.add(new TestCaseResult(testCases.get(i).inputData(), testCases.get(i).expectedOutput(),
                        "Internal Error: Exit marker missing", false, ResultStatus.ERROR, 0));
                continue;
            }

            // actualOutput = everything between CASE marker and TIME marker (or EXIT if no TIME)
            int outputEnd = (timeIdx != -1 && timeIdx < exitIdx) ? timeIdx : exitIdx;
            String actualOutput = output.substring(caseIdx, outputEnd).trim();

            // Parse execution time
            long execTimeMs = 0;
            if (timeIdx != -1 && timeIdx < exitIdx) {
                int timeEnd = output.indexOf("===", timeIdx + timeMarker.length());
                if (timeEnd != -1) {
                    String rawTime = output.substring(timeIdx + timeMarker.length(), timeEnd)
                            .replace("ms", "").trim();
                    try { execTimeMs = Long.parseLong(rawTime); } catch (Exception ignored) {}
                }
            }

            // Parse exit code
            int nextMarker = output.indexOf("===", exitIdx + exitMarker.length());
            String exitValueStr = output.substring(exitIdx + exitMarker.length(),
                    nextMarker == -1 ? output.length() : nextMarker).replace("=", "").trim();
            int exitValue = 0;
            try { exitValue = Integer.parseInt(exitValueStr); } catch (Exception ignored) {}

            ResultStatus status;
            boolean passed = false;
            if (exitValue == 124) {
                status = ResultStatus.TIME_OUT;
            } else if (exitValue != 0) {
                status = ResultStatus.ERROR;
            } else {
                passed = actualOutput.equals(testCases.get(i).expectedOutput().trim());
                status = passed ? ResultStatus.PASS : ResultStatus.FAIL;
            }

            results.add(new TestCaseResult(
                    testCases.get(i).inputData(),
                    testCases.get(i).expectedOutput(),
                    actualOutput,
                    passed,
                    status,
                    execTimeMs
            ));
        }

        return results;
    }

    // Legacy methods removed as they are replaced by runBatch



    private List<String> buildDockerCommand(
            String  dockerImage,
            Path    hostSrcPath,
            String  memFlag,
            String  shellCommand,
            boolean enableStdin
    ) {
        List<String> cmd = new ArrayList<>();
        cmd.add("docker");  cmd.add("run");
        cmd.add("--rm");

        cmd.add("--network"); cmd.add("none");

        cmd.add("--memory");  cmd.add(memFlag);
        cmd.add("--cpus");    cmd.add("0.5");

        if (enableStdin) cmd.add("-i");

        cmd.add("-v"); cmd.add(hostSrcPath.toAbsolutePath() + ":/src:ro");

        cmd.add("--tmpfs"); cmd.add("/app:rw,exec,size=" + tmpfsSizeMb + "m");

        cmd.add("-w"); cmd.add("/app");

        cmd.add(dockerImage);
        cmd.add("sh"); cmd.add("-c"); cmd.add(shellCommand);

        return cmd;
    }

    private String readStream(InputStream is) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append("\n");
        }
        return sb.toString();
    }
}
