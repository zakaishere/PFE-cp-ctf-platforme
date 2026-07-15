package com.university.platform.audit;

import com.university.platform.identity.service.JwtService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/{domain}/{contextId}/audit")
@RequiredArgsConstructor
public class AuditEventController {

    private final AuditEventService service;
    private final AuditDashboardService dashboardService;
    private final JwtService jwtService;

    @GetMapping
    public Page<AuditEventDTO> list(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) Severity severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        requireCanView(domain, contextId, authHeader);
        return service.findByContext(domain, contextId, severity,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 500)));
    }

    /** Per-user rollup table for the dashboard (IPs, tab/focus/paste counts, status). */
    @GetMapping("/summary")
    public List<UserAuditSummaryDTO> summary(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestHeader("Authorization") String authHeader) {
        requireCanView(domain, contextId, authHeader);
        return dashboardService.getEventSummary(domain, contextId);
    }

    /** Full chronological log for one user in this event (drill-down drawer). */
    @GetMapping("/user/{userId}")
    public List<AuditEventDTO> userLog(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @PathVariable UUID userId,
            @RequestHeader("Authorization") String authHeader) {
        requireCanView(domain, contextId, authHeader);
        return dashboardService.getUserLog(domain, contextId, userId);
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestHeader("Authorization") String authHeader) {
        requireCanView(domain, contextId, authHeader);
        byte[] csv = service.exportCsv(domain, contextId);
        String filename = "audit-" + domain.name().toLowerCase() + "-" + contextId + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    /** Prof may view only their own event; admin may view any. */
    private void requireCanView(AuditDomain domain, UUID contextId, String authHeader) {
        Claims claims = jwtService.parseToken(authHeader.substring(7));
        UUID callerId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));
        if (!dashboardService.canView(domain, contextId, callerId, isAdmin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your event.");
        }
    }
}
