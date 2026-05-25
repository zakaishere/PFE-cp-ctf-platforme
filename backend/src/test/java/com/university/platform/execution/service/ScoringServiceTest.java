package com.university.platform.execution.service;

import com.university.platform.assessment.model.ExamProblem;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.Problem;
import com.university.platform.assessment.repository.ExamProblemRepository;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Submission;
import com.university.platform.execution.repository.SubmissionRepository;
import com.university.platform.identity.model.Student;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScoringServiceTest {

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private ExamProblemRepository examProblemRepository;

    @InjectMocks
    private ScoringService scoringService;

    private Student student;
    private Problem  problem;
    private LiveExam exam;
    private ExamProblem ep;
    private UUID studentId;
    private UUID problemId;
    private UUID examId;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        problemId = UUID.randomUUID();
        examId    = UUID.randomUUID();

        student = new Student();
        student.setId(studentId);

        problem = Problem.builder().problemId(problemId).title("Test Problem").build();

        exam = LiveExam.builder()
                .scheduledStartTime(LocalDateTime.of(2026, 4, 17, 9, 0))
                .durationMinutes(120)
                .strictAccessCode("ABC123")
                .build();
        exam.setAssessmentId(examId);

        ep = ExamProblem.builder()
                .liveExam(exam)
                .problem(problem)
                .basePoints(500)
                .build();
    }

    private Submission buildSubmission(boolean accepted, int minutesAfterStart) {
        return Submission.builder()
                .student(student)
                .problem(problem)
                .assessment(exam)
                .isAccepted(accepted)
                .timestamp(exam.getScheduledStartTime().plusMinutes(minutesAfterStart))
                .sourceCode("print('hello')")
                .language(Submission.ProgrammingLanguage.PYTHON)
                .build();
    }

    @Test
    void calculateProblemScore_firstAcceptedAt30Min_returnsFullMinusTimePenalty() {
        Submission sub = buildSubmission(true, 30);
        when(submissionRepository.countFailedAttempts(studentId, problemId, examId)).thenReturn(0L);

        double score = scoringService.calculateProblemScore(sub, exam, ep);

        // 500 - (0 * 50) - (30 * 2) = 440
        assertThat(score).isEqualTo(440.0);
    }

    @Test
    void calculateProblemScore_threeFailedAttemptsThen50Min_returnsReducedScore() {
        Submission sub = buildSubmission(true, 50);
        when(submissionRepository.countFailedAttempts(studentId, problemId, examId)).thenReturn(3L);

        double score = scoringService.calculateProblemScore(sub, exam, ep);

        // 500 - (3 * 50) - (50 * 2) = 500 - 150 - 100 = 250
        assertThat(score).isEqualTo(250.0);
    }

    @Test
    void calculateProblemScore_heavyPenalty_clampedToFloor() {
        Submission sub = buildSubmission(true, 110);
        when(submissionRepository.countFailedAttempts(studentId, problemId, examId)).thenReturn(10L);

        double score = scoringService.calculateProblemScore(sub, exam, ep);

        // raw = 500 - 500 - 220 = -220 → floor = 500 * 0.3 = 150
        assertThat(score).isEqualTo(150.0);
    }

    @Test
    void calculateProblemScore_failedSubmission_alwaysZero() {
        Submission sub = buildSubmission(false, 10);

        double score = scoringService.calculateProblemScore(sub, exam, ep);

        assertThat(score).isEqualTo(0.0);
    }

    @Test
    void calculateFinalExamGrade_twoProblems_returnsCorrectGrade() {
        UUID problemId2 = UUID.randomUUID();
        Problem problem2 = Problem.builder().problemId(problemId2).title("P2").build();
        ExamProblem ep2 = ExamProblem.builder().liveExam(exam).problem(problem2).basePoints(300).build();

        Result r1 = Result.builder().pointsAwarded(400.0).teacherPenaltyOverride(0.0).build();
        Result r2 = Result.builder().pointsAwarded(240.0).teacherPenaltyOverride(50.0).build();

        Submission s1 = buildSubmission(true, 20);
        s1.setResult(r1);
        Submission s2 = Submission.builder()
                .student(student).problem(problem2).assessment(exam)
                .isAccepted(true).timestamp(exam.getScheduledStartTime().plusMinutes(40))
                .sourceCode("x=1").language(Submission.ProgrammingLanguage.PYTHON).build();
        s2.setResult(r2);

        when(examProblemRepository.findByLiveExam_AssessmentId(examId))
                .thenReturn(List.of(ep, ep2));
        when(submissionRepository.findAcceptedByStudentAndProblemAndExam(studentId, problemId, examId))
                .thenReturn(List.of(s1));
        when(submissionRepository.findAcceptedByStudentAndProblemAndExam(studentId, problemId2, examId))
                .thenReturn(List.of(s2));

        double grade = scoringService.calculateFinalExamGrade(studentId, examId);

        // earned = 400 + (240 - 50) = 590 ; total = 800
        // grade  = (590 / 800) * 20 = 14.75
        assertThat(grade).isEqualTo(14.75);
    }
}
