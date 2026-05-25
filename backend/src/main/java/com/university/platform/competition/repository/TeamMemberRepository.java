package com.university.platform.competition.repository;

import com.university.platform.competition.model.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, UUID> {

    List<TeamMember> findByTeamId(UUID teamId);

    int countByTeamId(UUID teamId);

    boolean existsByTeamIdAndStudentId(UUID teamId, UUID studentId);

    @Query("""
        SELECT tm FROM TeamMember tm
        WHERE tm.studentId = :studentId
          AND tm.teamId IN (SELECT t.teamId FROM Team t WHERE t.competitionId = :competitionId)
        """)
    Optional<TeamMember> findByCompetitionIdAndStudentId(
            @Param("competitionId") UUID competitionId,
            @Param("studentId") UUID studentId
    );

    @Query("""
        SELECT tm.teamId FROM TeamMember tm
        WHERE tm.studentId = :studentId
          AND tm.teamId IN (SELECT t.teamId FROM Team t WHERE t.competitionId = :competitionId)
        """)
    Optional<UUID> findTeamIdByCompetitionIdAndStudentId(
            @Param("competitionId") UUID competitionId,
            @Param("studentId") UUID studentId
    );
}
