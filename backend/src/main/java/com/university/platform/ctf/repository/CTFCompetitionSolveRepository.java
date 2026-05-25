package com.university.platform.ctf.repository;

import com.university.platform.ctf.entity.CTFCompetitionSolve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CTFCompetitionSolveRepository extends JpaRepository<CTFCompetitionSolve, UUID> {

    boolean existsByCompetitionIdAndChallengeIdAndTeamId(
            UUID competitionId, UUID challengeId, UUID teamId);

    int countByCompetitionIdAndChallengeId(UUID competitionId, UUID challengeId);

    int countByCompetitionId(UUID competitionId);

    List<CTFCompetitionSolve> findByCompetitionIdAndTeamId(UUID competitionId, UUID teamId);

    List<CTFCompetitionSolve> findByCompetitionIdOrderBySolvedAtAsc(UUID competitionId);

    /** Solves up to a cutoff — used to compute frozen scoreboards. */
    List<CTFCompetitionSolve> findByCompetitionIdAndSolvedAtLessThanEqualOrderBySolvedAtAsc(
            UUID competitionId, LocalDateTime cutoff);

    int countByCompetitionIdAndTeamId(UUID competitionId, UUID teamId);

    int countByCompetitionIdAndTeamIdAndSolvedBy(UUID competitionId, UUID teamId, UUID solvedBy);

    @Query("SELECT COALESCE(SUM(s.pointsAwarded), 0) FROM CTFCompetitionSolve s " +
           "WHERE s.competitionId = :compId AND s.teamId = :teamId AND s.solvedBy = :userId")
    int sumPointsAwardedByMember(@Param("compId") UUID compId, @Param("teamId") UUID teamId, @Param("userId") UUID userId);

    @Query("SELECT s FROM CTFCompetitionSolve s WHERE s.competitionId = :compId " +
           "ORDER BY s.solvedAt DESC")
    List<CTFCompetitionSolve> findRecentByCompetition(@Param("compId") UUID compId);
}
