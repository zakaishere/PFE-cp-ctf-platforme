package com.university.platform.execution.repository;

import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResultRepository extends JpaRepository<Result, UUID> {

    Optional<Result> findBySubmission_SubmissionId(UUID submissionId);

    boolean existsBySubmission_Student_IdAndSubmission_Problem_ProblemIdAndStatus(UUID studentId, UUID problemId, Result.ResultStatus status);
}
