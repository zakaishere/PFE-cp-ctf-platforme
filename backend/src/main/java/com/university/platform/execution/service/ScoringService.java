package com.university.platform.execution.service;

import com.university.platform.assessment.model.ExamProblem;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.repository.ExamProblemRepository;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScoringService {

    private static final Logger log = LoggerFactory.getLogger(ScoringService.class);

    private final SubmissionRepository submissionRepository;
    private final ExamProblemRepository examProblemRepository;

    public double calculateProblemScore(Submission submission, LiveExam exam, ExamProblem ep) {
        if (!Boolean.TRUE.equals(submission.getIsAccepted())) {
            return 0.0;
        }

        if (Boolean.FALSE.equals(exam.getIsPenaltyEnabled())) {
            return ep.getBasePoints();
        }

        long failedAttempts = submissionRepository.countFailedAttempts(
                submission.getStudent().getId(),
                submission.getProblem().getProblemId(),
                exam.getAssessmentId()
        );

        long minutesElapsed = ChronoUnit.MINUTES.between(
                exam.getScheduledStartTime(),
                submission.getTimestamp()
        );

        double raw   = ep.getBasePoints() - (failedAttempts * 50.0) - (minutesElapsed * 2.0);
        double floor = ep.getBasePoints() * 0.3;

        return Math.max(raw, floor);
    }

    public double calculateFinalExamGrade(UUID studentId, UUID examId) {
        List<ExamProblem> examProblems = examProblemRepository.findByLiveExam_AssessmentId(examId);

        if (examProblems.isEmpty()) {
            return 0.0;
        }

        double totalPossible = examProblems.stream()
                .mapToDouble(ExamProblem::getBasePoints)
                .sum();

        double earned = 0.0;
        for (ExamProblem ep : examProblems) {
            UUID problemId = ep.getProblem().getProblemId();
            List<Submission> acceptedSubmissions = submissionRepository
                    .findAcceptedByStudentAndProblemAndExam(studentId, problemId, examId);

            double best = acceptedSubmissions.stream()
                    .filter(s -> s.getResult() != null)
                    .mapToDouble(s -> s.getResult().getPointsAwarded()
                                   - s.getResult().getTeacherPenaltyOverride())
                    .max()
                    .orElse(0.0);

            earned += Math.max(best, 0.0);
        }

        double grade = (earned / totalPossible) * 20.0;
        return Math.round(grade * 100.0) / 100.0;
    }
}
