package com.university.platform.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Prints a concise startup banner once the context is ready, and warns when
 * security-sensitive secrets are still at their placeholder defaults.
 */
@Component
@Slf4j
public class StartupLogger {

    @Value("${spring.profiles.active:production}")
    private String activeProfile;

    @Value("${ctf.instance.host}")
    private String ctfInstanceHost;

    @Value("${docker.host}")
    private String dockerHost;

    @Value("${ctf.flag-secret}")
    private String flagSecret;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        log.info("╔══════════════════════════════════════╗");
        log.info("║       PSP Platform Started           ║");
        log.info("╠══════════════════════════════════════╣");
        log.info("║ Profile:    {}", pad(activeProfile, 24) + "║");
        log.info("║ CTF Host:   {}", pad(ctfInstanceHost, 24) + "║");
        log.info("║ Docker:     {}", pad(maskDockerHost(dockerHost), 24) + "║");
        log.info("╠══════════════════════════════════════╣");

        boolean hasSecurityIssues = false;

        if (flagSecret.contains("CHANGE_ME")) {
            log.warn("║ ⚠ CTF_FLAG_SECRET is not set!        ║");
            hasSecurityIssues = true;
        }
        if (jwtSecret.contains("CHANGE_ME")) {
            log.warn("║ ⚠ JWT_SECRET is not set!             ║");
            hasSecurityIssues = true;
        }
        if ("production".equals(activeProfile) && hasSecurityIssues) {
            log.warn("║ ⚠ RUNNING IN PROD WITH WEAK SECRETS  ║");
        }

        log.info("╚══════════════════════════════════════╝");
    }

    private String pad(String s, int len) {
        if (s == null) s = "not set";
        if (s.length() > len) s = s.substring(0, len - 3) + "...";
        return String.format("%-" + len + "s", s);
    }

    private String maskDockerHost(String host) {
        if (host.startsWith("unix://")) return "local socket";
        return host.replaceAll("(\\d+\\.\\d+)\\.\\d+\\.\\d+", "$1.*.*");
    }
}
