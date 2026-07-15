package com.university.platform.runtime;

/**
 * Unified abstraction over the two Docker subsystems used by the platform:
 * <ul>
 *   <li>Ephemeral one-shot runs (Exam + CP code execution) — see {@link EphemeralRunRuntime}.</li>
 *   <li>Long-lived per-challenge instances (CTF) — see {@link DockerJavaRuntime}.</li>
 * </ul>
 *
 * <p>Existing services ({@code DockerService}, {@code CTFInstanceService}) still hold the
 * domain-specific logic; this interface is the seam for uniform availability probing,
 * health reporting, and future consolidation. New code should prefer this interface; old
 * code is migrated incrementally.
 */
public interface ContainerRuntime {

    /** Display name for logs / health reports. */
    String name();

    /**
     * Liveness probe: returns {@code true} iff the backing Docker daemon can be reached
     * and is responsive. Must be cheap enough to invoke per health check.
     */
    boolean isAvailable();

    /** Ephemeral one-shot run. Implementations that don't support this throw. */
    RunResult runEphemeral(EphemeralRunSpec spec) throws Exception;

    /** Start a long-lived instance. Implementations that don't support this throw. */
    InstanceHandle startInstance(InstanceSpec spec) throws Exception;

    /** Stop a long-lived instance. No-op if the id is unknown. */
    void stopInstance(String containerId);
}
