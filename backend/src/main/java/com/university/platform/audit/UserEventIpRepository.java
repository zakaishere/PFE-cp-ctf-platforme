package com.university.platform.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserEventIpRepository extends JpaRepository<UserEventIp, UUID> {

    Optional<UserEventIp> findByUserIdAndDomainAndContextId(UUID userId, AuditDomain domain, UUID contextId);

    List<UserEventIp> findByDomainAndContextId(AuditDomain domain, UUID contextId);
}
