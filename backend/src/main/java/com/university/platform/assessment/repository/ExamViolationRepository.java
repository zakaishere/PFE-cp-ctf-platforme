package com.university.platform.assessment.repository;
import com.university.platform.assessment.model.ExamViolation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ExamViolationRepository extends JpaRepository<ExamViolation, UUID> {
}
