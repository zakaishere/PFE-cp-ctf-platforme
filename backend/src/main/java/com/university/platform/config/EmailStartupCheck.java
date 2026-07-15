package com.university.platform.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Fires once at startup and warns loudly if email verification is required
 * (app.security.disable-verification=false, the prod default) but no SMTP
 * credentials are configured. Without this, registration/verify-email/
 * forgot-password all silently fail at send time — the request succeeds,
 * the OTP is generated, but the email never leaves the server and the
 * account becomes permanently unverifiable. See EmailService#send, which
 * only logs a MessagingException rather than surfacing it to the caller
 * (correct, to avoid leaking whether an email is registered — but it means
 * a misconfigured mail account degrades silently in production).
 */
@Slf4j
@Component
public class EmailStartupCheck {

    @Value("${app.security.disable-verification:false}")
    private boolean disableVerification;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @EventListener(ApplicationReadyEvent.class)
    public void checkMailConfig() {
        if (disableVerification) {
            // Testing mode: no OTP is ever sent, so credentials are irrelevant.
            return;
        }
        if (mailUsername.isBlank() || mailPassword.isBlank()) {
            log.warn("═══════════════════════════════════════════════════════");
            log.warn("  Email verification is REQUIRED (disable-verification=false)");
            log.warn("  but MAIL_USERNAME / MAIL_PASSWORD are not set.");
            log.warn("  Registration, email verification, and password-reset OTPs");
            log.warn("  will be generated but NEVER DELIVERED — accounts will be");
            log.warn("  stuck unverified. Set MAIL_USERNAME and MAIL_PASSWORD in .env");
            log.warn("  (a Gmail App Password if using the default smtp.gmail.com),");
            log.warn("  or set app.security.disable-verification=true for a demo");
            log.warn("  deployment that doesn't need real email.");
            log.warn("═══════════════════════════════════════════════════════");
        }
    }
}
