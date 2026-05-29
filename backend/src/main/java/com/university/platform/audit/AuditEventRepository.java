package com.university.platform.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    Page<AuditEvent> findByDomainAndContextIdOrderByCreatedAtDesc(
            AuditDomain domain, UUID contextId, Pageable pageable);

    List<AuditEvent> findByDomainAndContextIdOrderByCreatedAtDesc(
            AuditDomain domain, UUID contextId);

    @Query("""
        SELECT a FROM AuditEvent a
        WHERE a.domain = :domain
          AND a.contextId = :contextId
          AND (:severity IS NULL OR a.severity = :severity)
        ORDER BY a.createdAt DESC
    """)
    Page<AuditEvent> findByContextFiltered(
            @Param("domain") AuditDomain domain,
            @Param("contextId") UUID contextId,
            @Param("severity") Severity severity,
            Pageable pageable);
}
