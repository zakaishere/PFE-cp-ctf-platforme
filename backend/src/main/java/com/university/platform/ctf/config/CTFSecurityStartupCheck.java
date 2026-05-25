package com.university.platform.ctf.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Fires once at startup and warns loudly if the CTF flag secret has not been
 * changed from the default sentinel value.
 *
 * Set CTF_FLAG_SECRET to a 32-byte random hex string before any real competition:
 *   openssl rand -hex 32
 */
@Slf4j
@Component
public class CTFSecurityStartupCheck {

    @Value("${ctf.flag-secret:CHANGE_ME}")
    private String flagSecret;

    @EventListener(ApplicationReadyEvent.class)
    public void checkSecrets() {
        if ("CHANGE_ME".equals(flagSecret) || flagSecret.length() < 16) {
            log.warn("═══════════════════════════════════════════════════════");
            log.warn("  CTF FLAG SECRET is weak or still set to the default!");
            log.warn("  Set the CTF_FLAG_SECRET environment variable before");
            log.warn("  running any real competition. Generate with:");
            log.warn("    openssl rand -hex 32");
            log.warn("  All per-team HMAC flags are predictable without this.");
            log.warn("═══════════════════════════════════════════════════════");
        }
    }
}
