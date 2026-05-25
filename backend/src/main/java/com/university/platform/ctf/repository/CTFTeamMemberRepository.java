package com.university.platform.ctf.repository;

import com.university.platform.ctf.entity.CTFTeamMember;
import com.university.platform.ctf.entity.CTFTeamMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CTFTeamMemberRepository extends JpaRepository<CTFTeamMember, CTFTeamMemberId> {

    List<CTFTeamMember> findByIdTeamId(UUID teamId);

    int countByIdTeamId(UUID teamId);

    boolean existsByIdTeamIdAndIdUserId(UUID teamId, UUID userId);

    void deleteByIdTeamIdAndIdUserId(UUID teamId, UUID userId);

    @Query("SELECT tm FROM CTFTeamMember tm JOIN CTFTeam t ON t.id = tm.id.teamId " +
           "WHERE t.competitionId = :competitionId AND tm.id.userId = :userId")
    Optional<CTFTeamMember> findByCompetitionIdAndUserId(
            @Param("competitionId") UUID competitionId,
            @Param("userId") UUID userId);

    @Query("SELECT COUNT(tm) FROM CTFTeamMember tm JOIN CTFTeam t ON t.id = tm.id.teamId " +
           "WHERE t.competitionId = :competitionId")
    int countParticipantsByCompetition(@Param("competitionId") UUID competitionId);
}
