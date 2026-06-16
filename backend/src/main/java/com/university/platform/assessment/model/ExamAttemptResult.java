package com.university.platform.assessment.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Best partial-credit result per (assessment, problem, student) for Exam/TP.
 *
 * Unlike competitions, assessments have no teams, no penalties and no time
 * bonus — only the best score a student has achieved on each problem. Total
 * grade = sum(best_score) / sum(maxPoints).
 */
@Entity
@Table(
    name = "exam_attempt_results",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_exam_attempt",
        columnNames = {"assessment_id", "problem_id", "student_id"}
    ),
    indexes = {
        @Index(name = "idx_exam_attempt_assessment_student",
               columnList = "assessment_id, student_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamAttemptResult {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "assessment_id", nullable = false, columnDefinition = "uuid")
    private UUID assessmentId;

    @Column(name = "problem_id", nullable = false, columnDefinition = "uuid")
    private UUID problemId;

    @Column(name = "student_id", nullable = false, columnDefinition = "uuid")
    private UUID studentId;

    @Column(name = "best_score", nullable = false)
    @Builder.Default
    private int bestScore = 0;

    @Column(name = "best_passed", nullable = false)
    @Builder.Default
    private int bestPassed = 0;

    @Column(name = "best_total", nullable = false)
    @Builder.Default
    private int bestTotal = 0;

    @Column(name = "attempts", nullable = false)
    @Builder.Default
    private int attempts = 0;

    @Column(name = "finalized", nullable = false)
    @Builder.Default
    private boolean finalized = false;

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Optimistic-lock backstop; the hot path also locks this row for update. */
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private long version = 0;

    public static ExamAttemptResult create(UUID assessmentId, UUID problemId, UUID studentId) {
        return ExamAttemptResult.builder()
                .assessmentId(assessmentId)
                .problemId(problemId)
                .studentId(studentId)
                .build();
    }
}
