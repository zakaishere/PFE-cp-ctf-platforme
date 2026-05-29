package com.university.platform.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/{domain}/{contextId}/audit")
@RequiredArgsConstructor
public class AuditEventController {

    private final AuditEventService service;

    @GetMapping
    public Page<AuditEventDTO> list(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId,
            @RequestParam(required = false) Severity severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.findByContext(domain, contextId, severity,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 500)));
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable AuditDomain domain,
            @PathVariable UUID contextId) {
        byte[] csv = service.exportCsv(domain, contextId);
        String filename = "audit-" + domain.name().toLowerCase() + "-" + contextId + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
