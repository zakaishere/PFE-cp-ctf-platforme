package com.university.platform.gamification.service;

import com.university.platform.gamification.dto.LeaderboardEntryDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.function.ToIntFunction;

/**
 * Triple leaderboard (CP / CTF / Global) computed from source tables:
 *  - CP  = judge points from results (practice problems, exams, TPs, CP competitions)
 *  - CTF = ctf_competition_solves (per solving user) + ctf_solves (practice)
 *  - Global = weighted composite of the two.
 *
 * Kept separate from the legacy GET /api/leaderboard endpoint, which is untouched.
 */
@Service
@RequiredArgsConstructor
public class LeaderboardRankingService {

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${leaderboard.weight.cp:0.5}")
    private double cpWeight;

    @Value("${leaderboard.weight.ctf:0.5}")
    private double ctfWeight;

    /** Per-student aggregates pulled in one query. */
    private record Row(String userId, String username, String fullName, String avatarUrl, String avatarId,
                       int cpScore, int cpSolved,
                       int ctfScore, int ctfSolved) {}

    private static final String AGGREGATE_SQL = """
        SELECT
            CAST(u.id AS text)                                           AS user_id,
            COALESCE(u.username,
                     LOWER(SPLIT_PART(u.email, '@', 1)) || '_' || SUBSTRING(CAST(u.id AS text), 1, 6))
                                                                 AS username,
            TRIM(u.first_name || ' ' || u.last_name)             AS full_name,
            u.avatar_url                                         AS avatar_url,
            u.avatar_id                                          AS avatar_id,
            COALESCE(cp.score, 0)                                AS cp_score,
            COALESCE(cp.solved, 0)                               AS cp_solved,
            COALESCE(prac.score, 0) + COALESCE(comp.score, 0)    AS ctf_score,
            COALESCE(prac.solved, 0) + COALESCE(comp.solved, 0)  AS ctf_solved
        FROM users u
        JOIN students st ON st.user_id = u.id
        LEFT JOIN (
            SELECT s.student_id AS uid,
                   SUM(r.points_awarded)                                    AS score,
                   COUNT(DISTINCT s.problem_id) FILTER (WHERE r.status = 'PASS') AS solved
            FROM results r
            JOIN submissions s ON r.submission_id = s.submission_id
            GROUP BY s.student_id
        ) cp ON cp.uid = u.id
        LEFT JOIN (
            SELECT user_id AS uid, SUM(points_awarded) AS score, COUNT(*) AS solved
            FROM ctf_solves
            GROUP BY user_id
        ) prac ON prac.uid = u.id
        LEFT JOIN (
            SELECT solved_by AS uid, SUM(points_awarded) AS score, COUNT(*) AS solved
            FROM ctf_competition_solves
            WHERE solved_by IS NOT NULL
            GROUP BY solved_by
        ) comp ON comp.uid = u.id
        """;

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDTO> getCpRanking(int limit) {
        return rank(fetchRows(), Row::cpScore, Row::cpSolved, limit);
    }

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDTO> getCtfRanking(int limit) {
        return rank(fetchRows(), Row::ctfScore, Row::ctfSolved, limit);
    }

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDTO> getGlobalRanking(int limit) {
        return rank(fetchRows(),
                r -> (int) Math.round(r.cpScore() * cpWeight + r.ctfScore() * ctfWeight),
                r -> r.cpSolved() + r.ctfSolved(),
                limit);
    }

    /** A user's scores, solve counts and positions across the three leaderboards. */
    public record UserRanks(
            int cpScore, int cpSolved, Integer cpRank,
            int ctfScore, int ctfSolved, Integer ctfRank,
            int globalScore, Integer globalRank) {}

    @Transactional(readOnly = true)
    public UserRanks ranksFor(java.util.UUID userId) {
        List<Row> rows = fetchRows();
        String id = userId.toString();
        Row me = rows.stream().filter(r -> r.userId().equals(id)).findFirst().orElse(null);

        ToIntFunction<Row> globalScore =
                r -> (int) Math.round(r.cpScore() * cpWeight + r.ctfScore() * ctfWeight);

        if (me == null) return new UserRanks(0, 0, null, 0, 0, null, 0, null);

        return new UserRanks(
                me.cpScore(), me.cpSolved(), rankOf(rows, me, Row::cpScore),
                me.ctfScore(), me.ctfSolved(), rankOf(rows, me, Row::ctfScore),
                globalScore.applyAsInt(me), rankOf(rows, me, globalScore));
    }

    /** 1-based position of `me` when sorted by `score` desc; null when their score is 0. */
    private static Integer rankOf(List<Row> rows, Row me, ToIntFunction<Row> score) {
        int myScore = score.applyAsInt(me);
        if (myScore <= 0) return null;
        long ahead = rows.stream().filter(r -> score.applyAsInt(r) > myScore).count();
        return (int) ahead + 1;
    }

    // ── Internals ────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Row> fetchRows() {
        List<Object[]> raw = entityManager.createNativeQuery(AGGREGATE_SQL).getResultList();
        return raw.stream()
                .map(r -> new Row(
                        (String) r[0],
                        (String) r[1],
                        (String) r[2],
                        (String) r[3],
                        (String) r[4],
                        toInt(r[5]), toInt(r[6]),
                        toInt(r[7]), toInt(r[8])))
                .toList();
    }

    private List<LeaderboardEntryDTO> rank(List<Row> rows,
                                           ToIntFunction<Row> score,
                                           ToIntFunction<Row> solved,
                                           int limit) {
        List<Row> ranked = rows.stream()
                .filter(r -> score.applyAsInt(r) > 0)
                .sorted(Comparator.comparingInt(score).reversed()
                        .thenComparing(Row::fullName, String.CASE_INSENSITIVE_ORDER))
                .limit(Math.max(1, limit))
                .toList();

        return java.util.stream.IntStream.range(0, ranked.size())
                .mapToObj(i -> {
                    Row r = ranked.get(i);
                    int s = score.applyAsInt(r);
                    return new LeaderboardEntryDTO(
                            i + 1, r.userId(), r.username(), r.fullName(), r.avatarUrl(), r.avatarId(),
                            s, solved.applyAsInt(r), badgeFor(s));
                })
                .toList();
    }

    private static String badgeFor(int score) {
        if (score >= 5000) return "MASTER";
        if (score >= 2000) return "EXPERT";
        if (score >= 500)  return "INTERMEDIATE";
        return "BEGINNER";
    }

    private static int toInt(Object o) {
        return o == null ? 0 : (int) Math.round(((Number) o).doubleValue());
    }
}
