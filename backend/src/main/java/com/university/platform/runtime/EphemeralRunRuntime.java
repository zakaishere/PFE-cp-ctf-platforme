package com.university.platform.runtime;

import com.university.platform.execution.service.DockerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * Thin wrapper over the existing {@link DockerService} (ProcessBuilder shell-out path).
 * Adds a real availability probe (`docker info`) so callers can fail loud instead of
 * silently producing internal-error results when the docker CLI is missing.
 */
@Slf4j
@Component("ephemeralRuntime")
@RequiredArgsConstructor
public class EphemeralRunRuntime implements ContainerRuntime {

    private final DockerService dockerService;

    @Override
    public String name() { return "ephemeral (docker CLI)"; }

    @Override
    public boolean isAvailable() {
        try {
            Process p = new ProcessBuilder("docker", "info").redirectErrorStream(true).start();
            // `docker info` observed taking ~5s on this dev machine under load — 3s made
            // this boot-time probe a false-negative every time despite Docker being fine.
            boolean finished = p.waitFor(10, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                return false;
            }
            return p.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public RunResult runEphemeral(EphemeralRunSpec spec) throws Exception {
        var raw = dockerService.executeWithTestCases(
                spec.sourceCode(), spec.language(), spec.testCases(),
                spec.timeLimitMs(), spec.memoryLimitMb());
        return new RunResult(raw);
    }

    @Override
    public InstanceHandle startInstance(InstanceSpec spec) {
        throw new UnsupportedOperationException("EphemeralRunRuntime does not start long-lived instances");
    }

    @Override
    public void stopInstance(String containerId) {
        throw new UnsupportedOperationException("EphemeralRunRuntime does not manage long-lived instances");
    }
}
