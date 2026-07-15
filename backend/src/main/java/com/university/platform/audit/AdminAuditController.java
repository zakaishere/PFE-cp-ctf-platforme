package com.university.platform.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Admin-only global audit feed across every event/domain.
 * Gated to ADMIN in SecurityConfig (/api/admin/audit/**).
 */
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
public class AdminAuditController {

    private final AuditDashboardService dashboardService;
    private final AuditEventService auditEventService;

    @GetMapping("/global")
    public Page<AuditEventDTO> global(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "false") boolean flaggedOnly) {
        return dashboardService.getGlobal(
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200)), flaggedOnly);
    }

    /**
     * CSV export of the global audit log. Applies the same optional filters the
     * UI exposes: domain, severity, and an inclusive date range. Null/blank
     * params disable their respective filter.
     */
    @GetMapping(value = "/global/export", produces = "text/csv")
    public ResponseEntity<byte[]> exportGlobal(
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        AuditDomain domainFilter = null;
        if (domain != null && !domain.isBlank()) {
            try {
                domainFilter = AuditDomain.valueOf(domain.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown domain: " + domain);
            }
        }
        Severity severityFilter = null;
        if (severity != null && !severity.isBlank()) {
            try {
                severityFilter = Severity.valueOf(severity.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown severity: " + severity);
            }
        }
        LocalDateTime fromTs = from != null ? from.atStartOfDay() : null;
        LocalDateTime toTs   = to != null ? to.atTime(23, 59, 59) : null;

        byte[] csv = auditEventService.exportGlobalCsv(domainFilter, severityFilter, fromTs, toTs);
        String filename = "audit-log-" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv);
    }
}
