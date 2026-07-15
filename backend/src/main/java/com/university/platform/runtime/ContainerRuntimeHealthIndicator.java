package com.university.platform.runtime;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Exposes ephemeral + instance runtime status under /actuator/health so /actuator/health
 * reflects Docker availability instead of just app liveness.
 */
@Component("containerRuntime")
@RequiredArgsConstructor
public class ContainerRuntimeHealthIndicator implements HealthIndicator {

    private final EphemeralRunRuntime ephemeral;
    private final DockerJavaRuntime   instance;

    @Override
    public Health health() {
        boolean ephAvail = ephemeral.isAvailable();
        boolean insAvail = instance.isAvailable();

        Health.Builder b = (ephAvail && insAvail) ? Health.up() : Health.down();
        return b
                .withDetail("ephemeralRuntime", ephAvail ? "UP" : "DOWN")
                .withDetail("ephemeralRuntimeName", ephemeral.name())
                .withDetail("instanceRuntime", insAvail ? "UP" : "DOWN")
                .withDetail("instanceRuntimeName", instance.name())
                .build();
    }
}
