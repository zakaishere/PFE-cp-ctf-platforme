package com.university.platform.gamification.service;

import com.university.platform.gamification.dto.UserProfileDTO;
import com.university.platform.gamification.dto.UserProfileDTO.ActivityItemDTO;
import com.university.platform.identity.model.User;
import com.university.platform.identity.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Read-only profile aggregation: identity + triple-leaderboard scores/ranks
 * + a unified recent-activity feed (CTF practice solves, CTF competition
 * solves, accepted CP submissions).
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    private static final Set<String> VALID_AVATAR_IDS = Set.of(
            "ronin", "shogun", "ninja", "samurai", "kensei", "daimyo",
            "oni", "tengu", "kitsune", "yari", "katana", "kabuto");

    private final UserRepository userRepository;
    private final LeaderboardRankingService rankingService;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Last N activity items across all point sources.
     * Columns: type, title, points, ts, category, difficulty
     */
    private static final String ACTIVITY_SQL = """
        SELECT * FROM (
            SELECT 'ctf_solve'      AS type,
                   c.title          AS title,
                   s.points_awarded AS points,
                   s.solved_at      AS ts,
                   CAST(c.category AS text) AS category,
                   NULL             AS difficulty
            FROM ctf_solves s
            JOIN ctf_challenges c ON c.id = s.challenge_id
            WHERE s.user_id = :uid

            UNION ALL

            SELECT 'competition'    AS type,
                   c.title          AS title,
                   cs.points_awarded AS points,
                   cs.solved_at     AS ts,
                   CAST(c.category AS text) AS category,
                   NULL             AS difficulty
            FROM ctf_competition_solves cs
            JOIN ctf_challenges c ON c.id = cs.challenge_id
            WHERE cs.solved_by = :uid

            UNION ALL

            SELECT 'problem_solve'          AS type,
                   p.title                  AS title,
                   r.points_awarded         AS points,
                   sub.timestamp            AS ts,
                   NULL                     AS category,
                   CAST(p.difficulty_level AS text) AS difficulty
            FROM results r
            JOIN submissions sub ON sub.submission_id = r.submission_id
            JOIN problems p      ON p.problem_id      = sub.problem_id
            WHERE sub.student_id = :uid
              AND r.status = 'PASS'
              AND r.points_awarded > 0
        ) activity
        ORDER BY ts DESC
        LIMIT :lim
        """;

    @Transactional(readOnly = true)
    public UserProfileDTO getProfile(UUID userId, boolean includePrivate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
        return buildProfile(user, includePrivate);
    }

    @Transactional(readOnly = true)
    public UserProfileDTO getByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));
        return buildProfile(user, false);
    }

    @Transactional
    public UserProfileDTO updateProfile(UUID userId, com.university.platform.gamification.dto.UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));

        if (request.username() != null) {
            String candidate = request.username().trim().toLowerCase();
            if (!candidate.matches("[a-z0-9_.-]{3,50}")) {
                throw new IllegalArgumentException(
                        "Username must be 3-50 characters: letters, digits, '_', '.', '-'.");
            }
            userRepository.findByUsername(candidate)
                    .filter(other -> !other.getId().equals(user.getId()))
                    .ifPresent(other -> {
                        throw new IllegalStateException("Username already taken.");
                    });
            user.setUsername(candidate);
        }
        if (request.bio() != null) {
            String bio = request.bio().trim();
            if (bio.length() > 300) {
                throw new IllegalArgumentException("Bio must be at most 300 characters.");
            }
            user.setBio(bio.isEmpty() ? null : bio);
        }
        if (request.avatarUrl() != null) {
            String url = request.avatarUrl().trim();
            if (url.length() > 500) {
                throw new IllegalArgumentException("Avatar URL must be at most 500 characters.");
            }
            user.setAvatarUrl(url.isEmpty() ? null : url);
        }
        if (request.avatarId() != null) {
            String id = request.avatarId().trim();
            if (!id.isEmpty() && !VALID_AVATAR_IDS.contains(id)) {
                throw new IllegalArgumentException("Unknown avatar id: " + id);
            }
            user.setAvatarId(id.isEmpty() ? null : id);
        }

        userRepository.save(user);
        return buildProfile(user, true);
    }

    private UserProfileDTO buildProfile(User user, boolean includePrivate) {
        LeaderboardRankingService.UserRanks ranks = rankingService.ranksFor(user.getId());

        return new UserProfileDTO(
                user.getId().toString(),
                usernameOf(user),
                (user.getFirstName() + " " + user.getLastName()).trim(),
                includePrivate ? user.getEmail() : null,
                user.getAvatarUrl(),
                user.getAvatarId(),
                user.getCreatedAt(),
                user.getBio(),
                ranks.ctfScore(),
                ranks.cpScore(),
                ranks.globalScore(),
                ranks.ctfSolved(),
                ranks.cpSolved(),
                ranks.ctfRank(),
                ranks.cpRank(),
                ranks.globalRank(),
                recentActivity(user.getId(), 10),
                badgeFor(ranks.globalScore())
        );
    }

    /** Same formula as the migration_v24 backfill, for rows created before it ran. */
    private static String usernameOf(User user) {
        if (user.getUsername() != null) return user.getUsername();
        String local = user.getEmail().split("@")[0].toLowerCase();
        return local + "_" + user.getId().toString().substring(0, 6);
    }

    @SuppressWarnings("unchecked")
    private List<ActivityItemDTO> recentActivity(UUID userId, int limit) {
        List<Object[]> raw = entityManager.createNativeQuery(ACTIVITY_SQL)
                .setParameter("uid", userId)
                .setParameter("lim", limit)
                .getResultList();

        return raw.stream()
                .map(r -> new ActivityItemDTO(
                        (String) r[0],
                        (String) r[1],
                        r[2] == null ? 0 : (int) Math.round(((Number) r[2]).doubleValue()),
                        toLocalDateTime(r[3]),
                        (String) r[4],
                        (String) r[5]))
                .toList();
    }

    private static java.time.LocalDateTime toLocalDateTime(Object o) {
        if (o == null) return null;
        if (o instanceof Timestamp ts) return ts.toLocalDateTime();
        if (o instanceof java.time.LocalDateTime ldt) return ldt;
        if (o instanceof java.time.Instant i) return java.time.LocalDateTime.ofInstant(i, java.time.ZoneId.systemDefault());
        throw new IllegalStateException("Unexpected timestamp type: " + o.getClass());
    }

    private static String badgeFor(int score) {
        if (score >= 5000) return "MASTER";
        if (score >= 2000) return "EXPERT";
        if (score >= 500)  return "INTERMEDIATE";
        return "BEGINNER";
    }
}
