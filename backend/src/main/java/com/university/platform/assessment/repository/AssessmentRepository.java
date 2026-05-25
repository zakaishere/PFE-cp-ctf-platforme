package com.university.platform.assessment.repository;
import com.university.platform.assessment.model.Assessment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.model.OpenTP;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {

    @Query("SELECT a FROM Assessment a WHERE a.module.division.divisionId = :divisionId AND a.module.semester.semesterId = :semesterId")
    List<Assessment> findByDivisionAndSemester(@Param("divisionId") UUID divisionId,
                                               @Param("semesterId") UUID semesterId);

    @Query("""
        SELECT a FROM OpenTP a
        WHERE a.deadline < :now
          AND EXISTS (
              SELECT jr FROM com.university.platform.assessment.JoinRequest jr
              WHERE jr.assessmentId = a.assessmentId
                AND jr.status = :pendingStatus
          )
        """)
    List<OpenTP> findOpenTPsPastDeadlineWithPendingRequests(
            @Param("now") LocalDateTime now,
            @Param("pendingStatus") JoinRequestStatus pendingStatus);

    @Query("""
        SELECT a FROM Assessment a WHERE
          (a.visibilityMode = com.university.platform.assessment.VisibilityMode.MODULE_ONLY
            AND a.module IS NOT NULL
            AND a.module.division.divisionId = :divisionId
            AND a.module.semester.semesterId = :semesterId)
          OR a.visibilityMode = com.university.platform.assessment.VisibilityMode.ACCESS_CODE
          OR a.visibilityMode = com.university.platform.assessment.VisibilityMode.REQUEST_BASED
        """)
    List<Assessment> findVisibleToStudent(@Param("divisionId") UUID divisionId,
                                          @Param("semesterId") UUID semesterId);
}
