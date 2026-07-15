package com.university.platform.ctf.dto;

import com.university.platform.ctf.entity.CTFInstance;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Admin view of a running CTF instance for /api/ctf/admin/instances.
 * Deliberately EXCLUDES {@code flagValue} (and internal docker identifiers) so
 * the live flag is never serialized to the browser. Map from the entity via
 * {@link #from} — never return the raw {@link CTFInstance}.
 */
public record CTFAdminInstanceDTO(
        UUID id,
        UUID challengeId,
        UUID userId,
        UUID teamId,
        UUID competitionId,
        String containerName,
        Integer assignedPort,
        String connectionString,
        String status,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime expiresAt,
        Integer renewalCount
) {
    public static CTFAdminInstanceDTO from(CTFInstance i) {
        return new CTFAdminInstanceDTO(
                i.getId(),
                i.getChallengeId(),
                i.getUserId(),
                i.getTeamId(),
                i.getCompetitionId(),
                i.getContainerName(),
                i.getAssignedPort(),
                i.getConnectionString(),
                i.getStatus(),
                i.getErrorMessage(),
                i.getStartedAt(),
                i.getExpiresAt(),
                i.getRenewalCount()
        );
    }
}
