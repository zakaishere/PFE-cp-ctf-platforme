package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionAttemptStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CompetitionAttemptStatsRepository
        extends JpaRepository<CompetitionAttemptStats, UUID> {

    Optional<CompetitionAttemptStats> findByCompetitionIdAndProblemIdAndParticipantId(
            UUID competitionId, UUID problemId, UUID participantId);

    List<CompetitionAttemptStats> findByCompetitionIdAndParticipantId(
            UUID competitionId, UUID participantId);

    List<CompetitionAttemptStats> findByCompetitionId(UUID competitionId);
}
