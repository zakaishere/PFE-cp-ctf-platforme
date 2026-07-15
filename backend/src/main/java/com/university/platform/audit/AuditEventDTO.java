package com.university.platform.audit;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record AuditEventDTO(
        UUID id,
        AuditDomain domain,
        String eventType,
        UUID contextId,
        UUID challengeId,
        UUID actorUserId,
        UUID actorTeamId,
        UUID sourceTeamId,
        Map<String, Object> detail,
        Severity severity,
        Boolean dismissed,
        UUID dismissedBy,
        LocalDateTime dismissedAt,
        LocalDateTime createdAt
) {
    public static AuditEventDTO from(AuditEvent e) {
        return new AuditEventDTO(
                e.getId(),
                e.getDomain(),
                e.getEventType(),
                e.getContextId(),
                e.getChallengeId(),
                e.getActorUserId(),
                e.getActorTeamId(),
                e.getSourceTeamId(),
                e.getDetail(),
                e.getSeverity(),
                e.getDismissed(),
                e.getDismissedBy(),
                e.getDismissedAt(),
                e.getCreatedAt()
        );
    }
}
