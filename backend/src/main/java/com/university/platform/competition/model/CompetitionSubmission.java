package com.university.platform.competition.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "competition_submissions",
    indexes = {
        @Index(name = "idx_csub_competition_id", columnList = "competition_id"),
        @Index(name = "idx_csub_student_id",     columnList = "student_id"),
        @Index(name = "idx_csub_team_id",         columnList = "team_id"),
        @Index(name = "idx_csub_verdict",          columnList = "verdict")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionSubmission {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "competition_id", nullable = false, columnDefinition = "uuid")
    private UUID competitionId;

    @Column(name = "team_id", columnDefinition = "uuid")
    private UUID teamId;

    @Column(name = "student_id", nullable = false, columnDefinition = "uuid")
    private UUID studentId;

    @Column(name = "problem_id", nullable = false, columnDefinition = "uuid")
    private UUID problemId;

    @Column(name = "submission_id", nullable = false, columnDefinition = "uuid")
    private UUID submissionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "verdict", nullable = false, length = 10)
    private Verdict verdict;

    @Column(name = "score", nullable = false)
    private int score;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;

    @Column(name = "execution_time_ms", nullable = false)
    private long executionTimeMs;

    public enum Verdict { AC, WA, TLE, MLE, CE, RTE }
}
