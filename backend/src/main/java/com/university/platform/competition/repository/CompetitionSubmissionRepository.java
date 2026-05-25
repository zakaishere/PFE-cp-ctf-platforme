package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionSubmission;
import com.university.platform.competition.model.CompetitionSubmission.Verdict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CompetitionSubmissionRepository extends JpaRepository<CompetitionSubmission, UUID> {

    List<CompetitionSubmission> findByCompetitionId(UUID competitionId);

    int countByCompetitionIdAndStudentIdAndProblemId(UUID competitionId, UUID studentId, UUID problemId);

    int countByCompetitionIdAndTeamIdAndProblemId(UUID competitionId, UUID teamId, UUID problemId);

    boolean existsByCompetitionIdAndStudentIdAndProblemIdAndVerdict(
            UUID competitionId, UUID studentId, UUID problemId, Verdict verdict);

    boolean existsByCompetitionIdAndTeamIdAndProblemIdAndVerdict(
            UUID competitionId, UUID teamId, UUID problemId, Verdict verdict);

    @Query("""
        SELECT cs FROM CompetitionSubmission cs
        WHERE cs.competitionId = :competitionId
          AND cs.studentId = :studentId
          AND cs.problemId = :problemId
          AND cs.verdict = 'AC'
        ORDER BY cs.submittedAt ASC
        """)
    List<CompetitionSubmission> findAcByCompetitionAndStudentAndProblem(
            @Param("competitionId") UUID competitionId,
            @Param("studentId") UUID studentId,
            @Param("problemId") UUID problemId
    );

    @Query("""
        SELECT cs FROM CompetitionSubmission cs
        WHERE cs.competitionId = :competitionId
          AND cs.teamId = :teamId
          AND cs.problemId = :problemId
          AND cs.verdict = 'AC'
        ORDER BY cs.submittedAt ASC
        """)
    List<CompetitionSubmission> findAcByCompetitionAndTeamAndProblem(
            @Param("competitionId") UUID competitionId,
            @Param("teamId") UUID teamId,
            @Param("problemId") UUID problemId
    );

    List<CompetitionSubmission> findByCompetitionIdOrderBySubmittedAtAsc(UUID competitionId);
}
