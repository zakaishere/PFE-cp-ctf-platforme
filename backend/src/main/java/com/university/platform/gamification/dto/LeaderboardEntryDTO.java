package com.university.platform.gamification.dto;

/**
 * One row of the CP / CTF / Global leaderboards.
 * badge: "MASTER" | "EXPERT" | "INTERMEDIATE" | "BEGINNER" based on score.
 */
public record LeaderboardEntryDTO(
        int rank,
        String userId,
        String username,
        String fullName,
        String avatarUrl,
        String avatarId,
        int score,
        int solved,
        String badge
) {}
