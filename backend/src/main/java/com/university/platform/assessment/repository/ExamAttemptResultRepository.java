package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.ExamAttemptResult;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamAttemptResultRepository extends JpaRepository<ExamAttemptResult, UUID> {

    Optional<ExamAttemptResult> findByAssessmentIdAndProblemIdAndStudentId(
            UUID assessmentId, UUID problemId, UUID studentId);

    /** Pessimistic row lock on the unique (assessment, problem, student) row. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT r FROM ExamAttemptResult r
        WHERE r.assessmentId = :assessmentId
          AND r.problemId    = :problemId
          AND r.studentId    = :studentId
    """)
    Optional<ExamAttemptResult> findForUpdate(
            @Param("assessmentId") UUID assessmentId,
            @Param("problemId")    UUID problemId,
            @Param("studentId")    UUID studentId);

    /** Race-free upsert (never throws); call before {@link #findForUpdate}. */
    @Modifying
    @Query(value = """
        INSERT INTO exam_attempt_results
            (id, assessment_id, problem_id, student_id,
             best_score, best_passed, best_total, attempts, finalized, updated_at, version)
        VALUES (gen_random_uuid(), :assessmentId, :problemId, :studentId,
             0, 0, 0, 0, false, now(), 0)
        ON CONFLICT (assessment_id, problem_id, student_id) DO NOTHING
        """, nativeQuery = true)
    int insertIfAbsent(@Param("assessmentId") UUID assessmentId,
                       @Param("problemId")    UUID problemId,
                       @Param("studentId")    UUID studentId);

    List<ExamAttemptResult> findByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);

    List<ExamAttemptResult> findByAssessmentId(UUID assessmentId);
}
