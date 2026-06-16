package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionProblem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CompetitionProblemRepository extends JpaRepository<CompetitionProblem, UUID> {

    List<CompetitionProblem> findByCompetitionIdOrderByOrderIndexAsc(UUID competitionId);

    int countByCompetitionId(UUID competitionId);

    Optional<CompetitionProblem> findByCompetitionIdAndProblem_ProblemId(UUID competitionId, UUID problemId);

    boolean existsByCompetitionIdAndProblem_ProblemId(UUID competitionId, UUID problemId);

    void deleteByCompetitionIdAndProblem_ProblemId(UUID competitionId, UUID problemId);

    /**
     * Atomically claim first blood: sets the winner only if not already set.
     * Exactly one concurrent caller gets a return of 1; all others get 0.
     * Never read-then-set in Java.
     */
    @Modifying
    @Query("""
        UPDATE CompetitionProblem cp
           SET cp.firstBloodParticipantId = :participantId,
               cp.firstBloodAt            = :at
         WHERE cp.id = :id
           AND cp.firstBloodParticipantId IS NULL
    """)
    int claimFirstBlood(@Param("id") UUID competitionProblemId,
                        @Param("participantId") UUID participantId,
                        @Param("at") LocalDateTime at);
}
