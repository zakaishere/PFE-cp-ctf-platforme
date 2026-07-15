package com.university.platform.runtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Logs runtime availability at boot. Replaces the previous behaviour where Docker
 * absence was silent (CTF: null-bean mock mode; ephemeral: runs would fail at first
 * submission with no boot warning).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContainerRuntimeStartupCheck {

    private final EphemeralRunRuntime ephemeral;
    private final DockerJavaRuntime   instance;

    @EventListener(ApplicationReadyEvent.class)
    public void report() {
        boolean ephAvail = ephemeral.isAvailable();
        boolean insAvail = instance.isAvailable();
        log.info("[RUNTIME] {} : {}", ephemeral.name(), ephAvail ? "UP" : "DOWN");
        log.info("[RUNTIME] {} : {}",   instance.name(),  insAvail ? "UP" : "DOWN");
        if (!ephAvail) log.warn("[RUNTIME] Ephemeral runtime DOWN — code submissions will fail until Docker is reachable.");
        if (!insAvail) log.warn("[RUNTIME] Instance runtime DOWN — CTF challenge instances cannot be spawned.");
    }
}
