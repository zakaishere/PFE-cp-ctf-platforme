package com.university.platform.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditEventService {

    private final AuditEventRepository repo;
    private final ObjectMapper objectMapper;

    /**
     * Best-effort record: never throws — a failed audit write must not break the
     * domain operation that triggered it. Errors are logged only.
     */
    @Transactional
    public void record(AuditDomain domain,
                       String eventType,
                       UUID contextId,
                       UUID challengeId,
                       UUID actorUserId,
                       UUID actorTeamId,
                       UUID sourceTeamId,
                       Map<String, Object> detail,
                       Severity severity) {
        try {
            AuditEvent ev = AuditEvent.builder()
                    .domain(domain)
                    .eventType(eventType != null ? eventType : "UNKNOWN")
                    .contextId(contextId)
                    .challengeId(challengeId)
                    .actorUserId(actorUserId)
                    .actorTeamId(actorTeamId)
                    .sourceTeamId(sourceTeamId)
                    .detail(detail)
                    .severity(severity != null ? severity : Severity.INFO)
                    .build();
            repo.save(ev);
        } catch (Exception ex) {
            log.error("[AUDIT] Failed to record event domain={} type={} context={}: {}",
                    domain, eventType, contextId, ex.getMessage());
        }
    }

    public Page<AuditEventDTO> findByContext(AuditDomain domain,
                                             UUID contextId,
                                             Severity severityFilter,
                                             Pageable pageable) {
        return repo.findByContextFiltered(domain, contextId, severityFilter, pageable)
                .map(AuditEventDTO::from);
    }

    /**
     * CSV export — flat columns plus a JSON-serialized detail field. Safe to open
     * in Excel/Sheets: values that contain commas or quotes are properly quoted.
     */
    public byte[] exportCsv(AuditDomain domain, UUID contextId) {
        var events = repo.findByDomainAndContextIdOrderByCreatedAtDesc(domain, contextId);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter w = new PrintWriter(out, false, StandardCharsets.UTF_8)) {
            w.println("id,created_at,domain,event_type,severity,context_id,challenge_id,"
                    + "actor_user_id,actor_team_id,source_team_id,dismissed,dismissed_by,detail");
            for (AuditEvent e : events) {
                w.println(String.join(",",
                        csv(e.getId()),
                        csv(e.getCreatedAt()),
                        csv(e.getDomain()),
                        csv(e.getEventType()),
                        csv(e.getSeverity()),
                        csv(e.getContextId()),
                        csv(e.getChallengeId()),
                        csv(e.getActorUserId()),
                        csv(e.getActorTeamId()),
                        csv(e.getSourceTeamId()),
                        csv(e.getDismissed()),
                        csv(e.getDismissedBy()),
                        csv(detailJson(e.getDetail()))
                ));
            }
        }
        return out.toByteArray();
    }

    private String detailJson(Map<String, Object> detail) {
        if (detail == null || detail.isEmpty()) return "";
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (Exception ex) {
            return "";
        }
    }

    private String csv(Object v) {
        if (v == null) return "";
        String s = v.toString();
        boolean needsQuote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0;
        if (!needsQuote) return s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
