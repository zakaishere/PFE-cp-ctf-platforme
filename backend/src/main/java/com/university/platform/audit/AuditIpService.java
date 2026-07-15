package com.university.platform.audit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Tracks the distinct client IPs a user connects from within a single event.
 * The first time a second distinct IP appears, a MULTI_IP audit event
 * (severity CHEAT) is recorded so it surfaces in the existing audit
 * dashboard — flagged for manual review, never auto-actioned.
 *
 * Best-effort: never throws into the caller's request flow.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditIpService {

    private final UserEventIpRepository ipRepo;
    private final AuditEventService auditEventService;

    /** Pull the real client IP, honouring a reverse proxy's X-Forwarded-For. */
    public static String clientIp(HttpServletRequest req) {
        if (req == null) return null;
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();   // first hop = real client
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        return req.getRemoteAddr();
    }

    @Transactional
    public void recordIp(AuditDomain domain, UUID contextId, UUID userId, String ip) {
        if (domain == null || contextId == null || userId == null || ip == null || ip.isBlank()) return;
        try {
            UserEventIp row = ipRepo.findByUserIdAndDomainAndContextId(userId, domain, contextId)
                    .orElseGet(() -> UserEventIp.builder()
                            .userId(userId).domain(domain).contextId(contextId)
                            .distinctIps(new String[0]).multiIp(false).build());

            Set<String> ips = new LinkedHashSet<>(Arrays.asList(row.getDistinctIps()));
            boolean isNew = ips.add(ip);
            if (!isNew) {
                // Already seen this IP — just refresh the timestamp.
                row.setUpdatedAt(LocalDateTime.now());
                ipRepo.save(row);
                return;
            }

            boolean wasMulti = row.isMultiIp();
            row.setDistinctIps(ips.toArray(new String[0]));
            row.setMultiIp(ips.size() > 1);
            row.setUpdatedAt(LocalDateTime.now());
            ipRepo.save(row);

            // Fire the flag exactly once — on the transition into multi-IP.
            if (!wasMulti && row.isMultiIp()) {
                auditEventService.record(
                        domain, "MULTI_IP", contextId, null, userId, null, null,
                        Map.of("ips", ips, "concurrent", true),
                        Severity.CHEAT);
                log.warn("[AUDIT] MULTI_IP flagged user={} {} context={} ips={}",
                        userId, domain, contextId, ips);
            }
        } catch (Exception ex) {
            log.error("[AUDIT] recordIp failed user={} {} context={}: {}",
                    userId, domain, contextId, ex.getMessage());
        }
    }
}
