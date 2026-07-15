package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.TPFinalSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TPFinalSubmissionRepository extends JpaRepository<TPFinalSubmission, UUID> {

    Optional<TPFinalSubmission> findByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);

    boolean existsByAssessmentIdAndStudentId(UUID assessmentId, UUID studentId);
}
