package com.university.platform.execution.model;
import com.university.platform.assessment.model.AssessmentProblem;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.UUID;

@Entity
@Table(
    name = "results",
    indexes = {
        @Index(name = "idx_results_submission_id", columnList = "submission_id"),
        @Index(name = "idx_results_status",        columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Result {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "result_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID resultId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ResultStatus status;

    @Column(name = "execution_time_ms")
    private Integer executionTimeMs;

    @Column(name = "memory_used_mb")
    private Integer memoryUsedMb;

    @Builder.Default
    @Column(name = "points_awarded", nullable = false)
    private Double pointsAwarded = 0.0;

    @Builder.Default
    @Column(name = "teacher_penalty_override", nullable = false)
    private Double teacherPenaltyOverride = 0.0;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "submission_id",
        nullable = false,
        unique = true,
        foreignKey = @ForeignKey(name = "fk_results_submission")
    )
    private Submission submission;

    public enum ResultStatus {
        PASS,
        FAIL,
        ERROR,
        TIME_OUT,
        MEMORY_OUT
    }
}
