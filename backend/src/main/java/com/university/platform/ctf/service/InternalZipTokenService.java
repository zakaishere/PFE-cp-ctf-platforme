package com.university.platform.ctf.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Short-lived bearer tokens for GET /api/internal/zip/{challengeId}.
 *
 * That endpoint is permitAll() in SecurityConfig — the worker agent has no
 * platform JWT — and previously had no auth at all beyond "network
 * placement" (see the TODO that used to sit there). A challenge ZIP is the
 * platform's most sensitive CTF content: it usually contains the exact flag
 * -check logic, so an unauthenticated download is a direct answer-leak, not
 * just an availability concern.
 *
 * Token shape: "{expiryEpochSeconds}.{hex(HMAC-SHA256(secret, challengeId + ":" + expiry))}"
 * — same construction style as CTFFlagGenerator / WorkerAgentHmacSigner.
 * Reuses ctf.flag-secret rather than introducing a new required env var:
 * anyone holding that secret can already forge any flag on the platform, so
 * sharing it with this narrower, shorter-lived capability doesn't change the
 * threat model.
 */
@Service
public class InternalZipTokenService {

    private static final long TTL_SECONDS = 300; // build+download always starts within seconds of issuance

    @Value("${ctf.flag-secret:CHANGE_ME}")
    private String flagSecret;

    public String issue(UUID challengeId) {
        long expiry = Instant.now().getEpochSecond() + TTL_SECONDS;
        return expiry + "." + hmac(challengeId, expiry);
    }

    public boolean verify(UUID challengeId, String token) {
        if (token == null) return false;
        int dot = token.indexOf('.');
        if (dot < 0) return false;
        long expiry;
        try {
            expiry = Long.parseLong(token.substring(0, dot));
        } catch (NumberFormatException e) {
            return false;
        }
        if (Instant.now().getEpochSecond() > expiry) return false;

        String expectedMac = hmac(challengeId, expiry);
        byte[] given    = token.substring(dot + 1).getBytes(StandardCharsets.UTF_8);
        byte[] expected = expectedMac.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(given, expected); // timing-safe
    }

    private String hmac(UUID challengeId, long expiry) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(flagSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((challengeId + ":" + expiry).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("HMAC signing failed", e);
        }
    }
}
