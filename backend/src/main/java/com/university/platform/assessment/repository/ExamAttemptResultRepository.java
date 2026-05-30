package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.ExamAttemptResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamAttemptResultRepository extends JpaRepository<ExamAttemptResult, UUID> {

    Optional<ExamAttemptResult> findByAssessmentIdAndProblemIdAndStudentId(
            UUID assessmentId, UUID problemId, UUID studentId);

    List<ExamAttemptResult> findByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);

    List<ExamAttemptResult> findByAssessmentId(UUID assessmentId);
}
