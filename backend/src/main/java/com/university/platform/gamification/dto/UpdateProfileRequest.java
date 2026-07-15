package com.university.platform.gamification.dto;

/** PATCH /api/profile/me body — every field optional; only non-null fields are applied. */
public record UpdateProfileRequest(
        String username,
        String bio,
        String avatarUrl,
        String avatarId
) {}
