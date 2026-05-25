package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionViolation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CompetitionViolationRepository extends JpaRepository<CompetitionViolation, UUID> {
    List<CompetitionViolation> findByCompetitionIdAndStudentIdOrderByOccurredAtAsc(UUID competitionId, UUID studentId);
    int countByCompetitionIdAndStudentId(UUID competitionId, UUID studentId);
}
