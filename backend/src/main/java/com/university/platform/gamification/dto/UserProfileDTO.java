package com.university.platform.gamification.dto;

import java.time.LocalDateTime;
import java.util.List;

/** Aggregated public profile: identity + scores + ranks + recent activity. */
public record UserProfileDTO(
        String id,
        String username,
        String fullName,
        String email,        // null on public views
        String avatarUrl,
        String avatarId,
        LocalDateTime joinedAt,
        String bio,

        int ctfScore,
        int cpScore,
        int globalScore,

        int ctfSolved,
        int problemsSolved,

        Integer ctfRank,
        Integer cpRank,
        Integer globalRank,

        List<ActivityItemDTO> recentActivity,
        String badge
) {

    /** One entry of the recent-activity feed. */
    public record ActivityItemDTO(
            String type,        // "ctf_solve" | "problem_solve" | "competition" | "exam"
            String title,
            int points,
            LocalDateTime timestamp,
            String category,    // CTF solves only
            String difficulty   // problem solves only
    ) {}
}
