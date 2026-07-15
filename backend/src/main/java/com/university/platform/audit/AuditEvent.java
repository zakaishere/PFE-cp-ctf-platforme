package com.university.platform.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_events", indexes = {
        @Index(name = "idx_audit_context", columnList = "domain, context_id, created_at"),
        @Index(name = "idx_audit_actor",   columnList = "actor_user_id, created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditEvent {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "domain", nullable = false, length = 16)
    private AuditDomain domain;

    @Column(name = "event_type", nullable = false, length = 48)
    private String eventType;

    @Column(name = "context_id", nullable = false, columnDefinition = "uuid")
    private UUID contextId;

    @Column(name = "challenge_id", columnDefinition = "uuid")
    private UUID challengeId;

    @Column(name = "actor_user_id", nullable = false, columnDefinition = "uuid")
    private UUID actorUserId;

    @Column(name = "actor_team_id", columnDefinition = "uuid")
    private UUID actorTeamId;

    @Column(name = "source_team_id", columnDefinition = "uuid")
    private UUID sourceTeamId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    private Map<String, Object> detail;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "severity", nullable = false, length = 8)
    private Severity severity = Severity.INFO;

    @Builder.Default
    @Column(name = "dismissed", nullable = false)
    private Boolean dismissed = false;

    @Column(name = "dismissed_by", columnDefinition = "uuid")
    private UUID dismissedBy;

    @Column(name = "dismissed_at")
    private LocalDateTime dismissedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
