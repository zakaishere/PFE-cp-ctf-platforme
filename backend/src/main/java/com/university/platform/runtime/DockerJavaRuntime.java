package com.university.platform.runtime;

import com.github.dockerjava.api.DockerClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * Thin wrapper over the existing docker-java {@link DockerClient} bean used by
 * {@code CTFInstanceService} for long-lived per-challenge instances. Availability is a
 * real {@code docker ping}, replacing the previous silent mock-mode fallback.
 *
 * <p>The actual instance lifecycle remains in {@code CTFInstanceService}; this runtime is
 * the seam + health surface for the new abstraction. New code can prefer this interface;
 * the existing service stays untouched.
 */
@Slf4j
@Component("instanceRuntime")
public class DockerJavaRuntime implements ContainerRuntime {

    private final DockerClient dockerClient;

    public DockerJavaRuntime(@Nullable DockerClient dockerClient) {
        this.dockerClient = dockerClient;
    }

    @Override
    public String name() { return "instance (docker-java SDK)"; }

    @Override
    public boolean isAvailable() {
        if (dockerClient == null) return false;
        try {
            dockerClient.pingCmd().exec();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public RunResult runEphemeral(EphemeralRunSpec spec) {
        throw new UnsupportedOperationException("DockerJavaRuntime is for long-lived instances; use ephemeralRuntime");
    }

    @Override
    public InstanceHandle startInstance(InstanceSpec spec) {
        throw new UnsupportedOperationException(
                "Lifecycle still lives in CTFInstanceService — call this once that logic is migrated");
    }

    @Override
    public void stopInstance(String containerId) {
        if (dockerClient == null) return;
        try {
            dockerClient.stopContainerCmd(containerId).withTimeout(5).exec();
        } catch (Exception e) {
            log.warn("[RUNTIME] stop {} failed: {}", containerId, e.getMessage());
        }
    }
}
