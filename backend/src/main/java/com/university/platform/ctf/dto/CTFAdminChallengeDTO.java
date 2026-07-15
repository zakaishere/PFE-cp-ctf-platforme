package com.university.platform.ctf.dto;

import com.university.platform.ctf.entity.CTFChallenge;

import java.util.UUID;

/**
 * Admin list view of a CTF challenge for /api/ctf/admin/challenges.
 * Deliberately EXCLUDES {@code flagValue} and {@code flagHash} so neither the
 * plaintext flag nor its hash is ever serialized to the browser. Map from the
 * entity via {@link #from} — never return the raw {@link CTFChallenge}.
 */
public record CTFAdminChallengeDTO(
        UUID id,
        String title,
        String category,
        String difficulty,
        Integer basePoints,
        Boolean requiresInstance,
        Boolean isActive
) {
    public static CTFAdminChallengeDTO from(CTFChallenge c) {
        return new CTFAdminChallengeDTO(
                c.getId(),
                c.getTitle(),
                c.getCategory() != null ? c.getCategory().name() : null,
                c.getDifficulty() != null ? c.getDifficulty().name() : null,
                c.getBasePoints(),
                c.getRequiresInstance(),
                c.getIsActive()
        );
    }
}
