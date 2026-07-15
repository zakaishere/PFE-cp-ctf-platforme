package com.university.platform.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    // Global export with optional filters — any null param disables that filter.
    // :from/:to are wrapped in CAST(... AS timestamp) in their IS NULL checks so
    // PostgreSQL can determine the parameter type when they are null (otherwise:
    // "could not determine data type of parameter"). Same class of fix as the
    // CAST(:search AS string) in UserRepository.
    @Query("""
        SELECT a FROM AuditEvent a
        WHERE (:domain   IS NULL OR a.domain   = :domain)
          AND (:severity IS NULL OR a.severity = :severity)
          AND (CAST(:from AS timestamp) IS NULL OR a.createdAt >= :from)
          AND (CAST(:to   AS timestamp) IS NULL OR a.createdAt <= :to)
        ORDER BY a.createdAt DESC
    """)
    List<AuditEvent> findForExport(
            @Param("domain") AuditDomain domain,
            @Param("severity") Severity severity,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

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

    List<AuditEvent> findByDomainAndContextIdAndActorUserIdOrderByCreatedAtDesc(
            AuditDomain domain, UUID contextId, UUID actorUserId);

    // Global feed (admin) — optionally only flagged (severity = CHEAT) rows.
    @Query("""
        SELECT a FROM AuditEvent a
        WHERE (:flaggedOnly = false OR a.severity = com.university.platform.audit.Severity.CHEAT)
        ORDER BY a.createdAt DESC
    """)
    Page<AuditEvent> findGlobal(@Param("flaggedOnly") boolean flaggedOnly, Pageable pageable);
}
