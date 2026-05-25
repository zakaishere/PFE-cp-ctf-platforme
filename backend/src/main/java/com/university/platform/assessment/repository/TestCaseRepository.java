package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, UUID> {

    List<TestCase> findByProblem_ProblemIdOrderByIsHiddenAsc(UUID problemId);

    default List<TestCase> findByProblem_ProblemId(UUID problemId) {
        return findByProblem_ProblemIdOrderByIsHiddenAsc(problemId);
    }
}
