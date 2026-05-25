package com.university.platform.academic.repository;

import com.university.platform.academic.model.Division;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DivisionRepository extends JpaRepository<Division, UUID> {

    List<Division> findByDepartment_DeptId(UUID deptId);
}
