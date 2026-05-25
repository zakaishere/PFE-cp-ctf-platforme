package com.university.platform.assessment.repository;
import com.university.platform.assessment.model.AssessmentProblem;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface AssessmentProblemRepository extends JpaRepository<AssessmentProblem, UUID> {
    Integer countByAssessment_AssessmentId(UUID assessmentId);
    java.util.List<AssessmentProblem> findByAssessment_AssessmentIdOrderByOrderIndexAsc(UUID assessmentId);
}
