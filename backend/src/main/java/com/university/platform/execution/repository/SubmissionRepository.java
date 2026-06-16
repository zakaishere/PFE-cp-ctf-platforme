package com.university.platform.execution.repository;

import com.university.platform.execution.model.Submission;
import com.university.platform.execution.model.Submission.ProgrammingLanguage;
import com.university.platform.execution.model.Submission.SubmissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, UUID> {

    List<Submission> findByStudent_IdOrderByTimestampDesc(UUID studentId);

    List<Submission> findByStudent_IdAndProblem_ProblemId(UUID studentId, UUID problemId);

    long countByStudent_IdAndProblem_ProblemId(UUID studentId, UUID problemId);

    long countByStudent_IdAndProblem_ProblemIdAndAssessmentIsNullAndPlanningModeFalse(UUID studentId, UUID problemId);

    Page<Submission> findByAssessment_AssessmentId(UUID assessmentId, Pageable pageable);

    List<Submission> findByAssessment_AssessmentIdAndStudent_IdOrderByTimestampDesc(UUID assessmentId, UUID studentId);


    @Query("""
        SELECT COUNT(s) FROM Submission s
        WHERE s.student.id        = :studentId
          AND s.problem.problemId = :problemId
          AND s.assessment.assessmentId = :assessmentId
    """)
    long countAttempts(
            @Param("studentId")    UUID studentId,
            @Param("problemId")    UUID problemId,
            @Param("assessmentId") UUID assessmentId
    );

    List<Submission> findByStatus(SubmissionStatus status);

    @Query("SELECT DISTINCT s.problem.problemId FROM Submission s WHERE s.student.id = :studentId AND s.isAccepted = true")
    Set<UUID> findSolvedProblemIds(@Param("studentId") UUID studentId);

    @Query("SELECT DISTINCT s.problem.problemId FROM Submission s WHERE s.student.id = :studentId AND s.assessment.assessmentId = :assessmentId AND s.isAccepted = true AND s.planningMode = false")
    Set<UUID> findSolvedProblemIdsByAssessment(@Param("studentId") UUID studentId, @Param("assessmentId") UUID assessmentId);
    long countByStudent_IdAndProblem_ProblemIdAndPlanningModeFalse(UUID studentId, UUID problemId);

    @Query("""
        SELECT COUNT(s) FROM Submission s
        WHERE s.student.id              = :studentId
          AND s.problem.problemId       = :problemId
          AND s.assessment.assessmentId = :assessmentId
          AND s.isAccepted              = false
          AND s.planningMode            = false
    """)
    long countFailedAttempts(
            @Param("studentId")    UUID studentId,
            @Param("problemId")    UUID problemId,
            @Param("assessmentId") UUID assessmentId
    );

    @Query("""
        SELECT s FROM Submission s
        WHERE s.student.id              = :studentId
          AND s.problem.problemId       = :problemId
          AND s.assessment.assessmentId = :assessmentId
          AND s.isAccepted              = true
          AND s.planningMode            = false
        ORDER BY s.result.pointsAwarded DESC
    """)
    List<Submission> findAcceptedByStudentAndProblemAndExam(
            @Param("studentId")    UUID studentId,
            @Param("problemId")    UUID problemId,
            @Param("assessmentId") UUID assessmentId
    );

    long countByProblem_ProblemId(UUID problemId);

    long countByProblem_ProblemIdAndIsAcceptedTrue(UUID problemId);

    @Query("""
        SELECT s FROM Submission s
        WHERE s.student.id        = :studentId
          AND s.problem.problemId = :problemId
          AND s.planningMode      = false
        ORDER BY s.timestamp DESC
    """)
    List<Submission> findMySubmissionsForProblem(
            @Param("studentId") UUID studentId,
            @Param("problemId") UUID problemId,
            Pageable pageable
    );

    /**
     * Atomic idempotency claim: flips {@code scored} false→true in a single
     * conditional UPDATE. Returns 1 the first time (caller owns scoring) and 0
     * on any redelivery/concurrent attempt (caller must skip). Race-free and
     * portable (no DB-specific upsert needed).
     */
    @Modifying
    @Query("UPDATE Submission s SET s.scored = true WHERE s.submissionId = :id AND s.scored = false")
    int markScoredIfUnscored(@Param("id") UUID submissionId);

}

