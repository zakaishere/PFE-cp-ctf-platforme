package com.university.platform.assessment.repository;

import com.university.platform.assessment.model.ExamProblem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamProblemRepository extends JpaRepository<ExamProblem, UUID> {

    List<ExamProblem> findByLiveExam_AssessmentId(UUID examId);

    Optional<ExamProblem> findByLiveExam_AssessmentIdAndProblem_ProblemId(UUID examId, UUID problemId);
}
