package com.university.platform.competition.repository;

import com.university.platform.competition.model.CompetitionRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CompetitionRegistrationRepository extends JpaRepository<CompetitionRegistration, UUID> {

    boolean existsByCompetitionIdAndStudentId(UUID competitionId, UUID studentId);

    int countByCompetitionId(UUID competitionId);

    List<CompetitionRegistration> findByCompetitionId(UUID competitionId);
}
