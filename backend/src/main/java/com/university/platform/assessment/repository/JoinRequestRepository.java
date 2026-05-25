package com.university.platform.assessment.repository;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JoinRequestRepository extends JpaRepository<JoinRequest, UUID> {

    Optional<JoinRequest> findByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);

    Optional<JoinRequest> findByCompetitionIdAndStudentId(UUID competitionId, UUID studentId);

    boolean existsByAssessmentIdAndStudentIdAndStatus(UUID assessmentId, UUID studentId, JoinRequestStatus status);

    boolean existsByCompetitionIdAndStudentIdAndStatus(UUID competitionId, UUID studentId, JoinRequestStatus status);

    // Pageable variants (used by teacher list endpoints)
    Page<JoinRequest> findByAssessmentIdAndStatus(UUID assessmentId, JoinRequestStatus status, Pageable pageable);

    Page<JoinRequest> findByCompetitionIdAndStatus(UUID competitionId, JoinRequestStatus status, Pageable pageable);

    // List variants (used by auto-reject lifecycle jobs)
    List<JoinRequest> findByAssessmentIdAndStatus(UUID assessmentId, JoinRequestStatus status);

    List<JoinRequest> findByCompetitionIdAndStatus(UUID competitionId, JoinRequestStatus status);

    // Student "my requests" endpoints
    Page<JoinRequest> findByStudentId(UUID studentId, Pageable pageable);

    Page<JoinRequest> findByStudentIdAndStatus(UUID studentId, JoinRequestStatus status, Pageable pageable);

    @Query("""
        SELECT jr FROM JoinRequest jr
        WHERE jr.assessmentId = :assessmentId
          AND jr.status = :status
          AND jr.studentId IN (
              SELECT s.id FROM com.university.platform.identity.model.Student s
              WHERE s.division.divisionId = :divisionId
          )
        """)
    List<JoinRequest> findByAssessmentIdAndStatusAndStudentDivisionId(
            @Param("assessmentId") UUID assessmentId,
            @Param("status") JoinRequestStatus status,
            @Param("divisionId") UUID divisionId);

    @Query("""
        SELECT jr FROM JoinRequest jr
        WHERE jr.competitionId = :competitionId
          AND jr.status = :status
          AND jr.studentId IN (
              SELECT s.id FROM com.university.platform.identity.model.Student s
              WHERE s.division.divisionId = :divisionId
          )
        """)
    List<JoinRequest> findByCompetitionIdAndStatusAndStudentDivisionId(
            @Param("competitionId") UUID competitionId,
            @Param("status") JoinRequestStatus status,
            @Param("divisionId") UUID divisionId);

    long countByAssessmentIdAndStatus(UUID assessmentId, JoinRequestStatus status);

    long countByCompetitionIdAndStatus(UUID competitionId, JoinRequestStatus status);

    // Batch pending counts — single query for Patch 5
    @Query("""
        SELECT jr.assessmentId, COUNT(jr)
        FROM JoinRequest jr
        WHERE jr.assessmentId IN :ids AND jr.status = :status
        GROUP BY jr.assessmentId
        """)
    List<Object[]> countGroupedByAssessmentId(@Param("ids") List<UUID> ids,
                                               @Param("status") JoinRequestStatus status);

    @Query("""
        SELECT jr.competitionId, COUNT(jr)
        FROM JoinRequest jr
        WHERE jr.competitionId IN :ids AND jr.status = :status
        GROUP BY jr.competitionId
        """)
    List<Object[]> countGroupedByCompetitionId(@Param("ids") List<UUID> ids,
                                                @Param("status") JoinRequestStatus status);
}
