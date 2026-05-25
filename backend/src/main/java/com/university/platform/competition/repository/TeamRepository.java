package com.university.platform.competition.repository;

import com.university.platform.competition.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamRepository extends JpaRepository<Team, UUID> {

    List<Team> findByCompetitionId(UUID competitionId);

    Optional<Team> findByCompetitionIdAndInviteCode(UUID competitionId, String inviteCode);

    boolean existsByCompetitionIdAndInviteCode(UUID competitionId, String inviteCode);
}
