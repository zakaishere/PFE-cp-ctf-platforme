package com.university.platform.audit;

import com.university.platform.identity.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Lightweight session heartbeat: the arena calls this on entry so the platform
 * captures each participant's client IP even when they commit no violation.
 * This is what makes multi-IP detection meaningful (otherwise only cheaters
 * would ever have an IP on record).
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/audit/session")
@RequiredArgsConstructor
public class AuditSessionController {

    private final AuditIpService auditIpService;
    private final AuditEventService auditEventService;
    private final JwtService jwtService;

    @PostMapping("/{domain}/{contextId}")
    public ResponseEntity<Void> ping(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestHeader("Authorization") String authHeader,
            HttpServletRequest request) {
        UUID userId = UUID.fromString(jwtService.parseToken(authHeader.substring(7)).getSubject());
        auditIpService.recordIp(domain, contextId, userId, AuditIpService.clientIp(request));
        return ResponseEntity.accepted().build();
    }

    /**
     * Generic per-event anti-cheat reporter. Records a WARN audit event (tab
     * switch, focus loss, copy/paste, …) plus the caller's IP for multi-IP
     * detection. Domains that own a dedicated violation table (EXAM/TP via
     * /api/exams/cheat-logs, CP via /api/competitions/…/violations) keep using
     * those; this covers domains that don't (CTF competitions).
     */
    @PostMapping("/{domain}/{contextId}/violation")
    public ResponseEntity<Void> violation(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestBody ViolationPing body,
            @RequestHeader("Authorization") String authHeader,
            HttpServletRequest request) {
        UUID userId = UUID.fromString(jwtService.parseToken(authHeader.substring(7)).getSubject());
        String ip = AuditIpService.clientIp(request);
        Map<String, Object> detail = new HashMap<>();
        detail.put("violationType", body.type());
        if (body.details() != null) detail.put("details", body.details());
        if (ip != null) detail.put("ip", ip);
        auditEventService.record(domain, body.type(), contextId, null, userId, null, null, detail, Severity.WARN);
        auditIpService.recordIp(domain, contextId, userId, ip);
        return ResponseEntity.accepted().build();
    }

    public record ViolationPing(String type, String details) {}
}
