package com.university.platform.audit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/** Distinct client IPs seen for one user within one event (multi-IP anti-cheat). */
@Entity
@Table(name = "user_event_ips", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_event_ip", columnNames = {"user_id", "domain", "context_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEventIp {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "domain", nullable = false, length = 16)
    private AuditDomain domain;

    @Column(name = "context_id", nullable = false, columnDefinition = "uuid")
    private UUID contextId;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "distinct_ips", columnDefinition = "text[]")
    private String[] distinctIps = new String[0];

    @Builder.Default
    @Column(name = "multi_ip", nullable = false)
    private boolean multiIp = false;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
