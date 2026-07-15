package com.university.platform.execution.model;

import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.Problem;
import com.university.platform.identity.model.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "submissions",
    indexes = {
        @Index(name = "idx_submissions_student_id",    columnList = "student_id"),
        @Index(name = "idx_submissions_problem_id",    columnList = "problem_id"),
        @Index(name = "idx_submissions_assessment_id", columnList = "assessment_id"),
        @Index(name = "idx_submissions_status",        columnList = "status"),
        @Index(name = "idx_submissions_timestamp",     columnList = "timestamp"),
        @Index(name = "idx_submissions_competition_id", columnList = "competition_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Submission {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "submission_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID submissionId;

    @Column(name = "source_code", nullable = false, columnDefinition = "TEXT")
    private String sourceCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "language", nullable = false, length = 30)
    private ProgrammingLanguage language;

    @Builder.Default
    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Builder.Default
    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber = 1;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SubmissionStatus status = SubmissionStatus.PENDING;

    @Builder.Default
    @Column(name = "is_planning_mode", nullable = false)
    private boolean planningMode = false;

    @Builder.Default
    @Column(name = "is_accepted", nullable = false)
    private Boolean isAccepted = false;

    /**
     * Idempotency claim flag for scoring. Set exactly once via an atomic
     * conditional UPDATE ({@code markScoredIfUnscored}) so a redelivered or
     * concurrently-processed queue message scores a submission at most once.
     */
    @Builder.Default
    @Column(name = "scored", nullable = false)
    private boolean scored = false;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)

    @JoinColumn(
        name = "student_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_submissions_student")
    )
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "problem_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_submissions_problem")
    )
    private Problem problem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "assessment_id",
        foreignKey = @ForeignKey(name = "fk_submissions_assessment")
    )
    private Assessment assessment;

    @Column(name = "competition_id", nullable = true, columnDefinition = "uuid")
    private UUID competitionId;

    @OneToOne(
        mappedBy = "submission",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.LAZY
    )
    private Result result;

    public enum SubmissionStatus {
        PENDING,    
        COMPLETED   
    }

    public enum ProgrammingLanguage {
        JAVA, PYTHON, C, CPP, JAVASCRIPT, KOTLIN
    }
}
