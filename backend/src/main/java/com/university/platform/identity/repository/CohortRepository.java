package com.university.platform.identity.repository;
import com.university.platform.identity.model.Cohort;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CohortRepository extends JpaRepository<Cohort, UUID> {
    Optional<Cohort> findByDepartment_DeptIdAndYearAndSemester(UUID deptId, Integer year, String semester);
}
