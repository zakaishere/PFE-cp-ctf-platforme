package com.university.platform.competition.repository;

import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface CompetitionRepository extends JpaRepository<Competition, UUID> {

    List<Competition> findByStatus(CompetitionStatus status);

    @Query("SELECT c FROM Competition c WHERE c.status = :status AND c.startTime <= :now")
    List<Competition> findByStatusAndStartTimeOnOrBefore(
            @Param("status") CompetitionStatus status,
            @Param("now") LocalDateTime now
    );
}
