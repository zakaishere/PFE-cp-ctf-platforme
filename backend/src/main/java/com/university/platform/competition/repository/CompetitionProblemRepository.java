package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionProblem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

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
}
