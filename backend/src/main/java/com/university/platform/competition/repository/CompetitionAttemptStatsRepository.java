package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionAttemptStats;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CompetitionAttemptStatsRepository
        extends JpaRepository<CompetitionAttemptStats, UUID> {

    Optional<CompetitionAttemptStats> findByCompetitionIdAndProblemIdAndParticipantId(
            UUID competitionId, UUID problemId, UUID participantId);

    /**
     * Pessimistic row lock (SELECT ... FOR UPDATE) on the unique
     * (competition, problem, participant) row. Held until the surrounding
     * transaction commits so teammates sharing one participant row serialise
     * their multi-field updates (solved / firstSolvedAt / penalty / wrong).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT s FROM CompetitionAttemptStats s
        WHERE s.competitionId = :competitionId
          AND s.problemId     = :problemId
          AND s.participantId  = :participantId
    """)
    Optional<CompetitionAttemptStats> findForUpdate(
            @Param("competitionId") UUID competitionId,
            @Param("problemId")     UUID problemId,
            @Param("participantId") UUID participantId);

    /**
     * Race-free "create the row if it doesn't exist yet" — a Postgres upsert
     * that never throws (so it can't poison the surrounding transaction the way
     * a save() constraint violation would). Call before {@link #findForUpdate}.
     */
    @Modifying
    @Query(value = """
        INSERT INTO competition_attempt_stats
            (id, competition_id, problem_id, participant_id, is_team,
             wrong_attempts, first_solved_at, best_score, last_score,
             is_solved, penalty_minutes, version)
        VALUES (gen_random_uuid(), :competitionId, :problemId, :participantId, :team,
             0, NULL, 0, 0, false, 0, 0)
        ON CONFLICT (competition_id, problem_id, participant_id) DO NOTHING
        """, nativeQuery = true)
    int insertIfAbsent(@Param("competitionId") UUID competitionId,
                       @Param("problemId")     UUID problemId,
                       @Param("participantId") UUID participantId,
                       @Param("team")          boolean team);

    List<CompetitionAttemptStats> findByCompetitionIdAndParticipantId(
            UUID competitionId, UUID participantId);

    List<CompetitionAttemptStats> findByCompetitionId(UUID competitionId);
}
