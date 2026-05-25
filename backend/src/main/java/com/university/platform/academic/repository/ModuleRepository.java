package com.university.platform.academic.repository;

import com.university.platform.academic.model.Module;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ModuleRepository extends JpaRepository<Module, UUID> {

    List<Module> findByDivision_DivisionId(UUID divisionId);

    List<Module> findByDivision_DivisionIdAndSemester_SemesterId(UUID divisionId, UUID semesterId);
}
