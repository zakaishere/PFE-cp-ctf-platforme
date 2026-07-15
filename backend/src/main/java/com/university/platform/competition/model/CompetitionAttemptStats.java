package com.university.platform.competition.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Per-participant, per-problem aggregate that drives the competition scoreboard.
 *
 * participant_id is the team_id in TEAM mode and the student user_id in SOLO
 * mode (disambiguated by {@link #team}). One row per (competition, problem,
 * participant); maintained incrementally by CompetitionScoringService.
 */
@Entity
@Table(
    name = "competition_attempt_stats",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_attempt_stats",
        columnNames = {"competition_id", "problem_id", "participant_id"}
    ),
    indexes = {
        @Index(name = "idx_attempt_stats_comp_part", columnList = "competition_id, participant_id"),
        @Index(name = "idx_attempt_stats_comp_prob", columnList = "competition_id, problem_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionAttemptStats {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "competition_id", nullable = false, columnDefinition = "uuid")
    private UUID competitionId;

    @Column(name = "problem_id", nullable = false, columnDefinition = "uuid")
    private UUID problemId;

    @Column(name = "participant_id", nullable = false, columnDefinition = "uuid")
    private UUID participantId;

    @Column(name = "is_team", nullable = false)
    @Builder.Default
    private boolean team = false;

    @Column(name = "wrong_attempts", nullable = false)
    @Builder.Default
    private int wrongAttempts = 0;

    @Column(name = "first_solved_at")
    private LocalDateTime firstSolvedAt;

    @Column(name = "best_score", nullable = false)
    @Builder.Default
    private int bestScore = 0;

    @Column(name = "last_score", nullable = false)
    @Builder.Default
    private int lastScore = 0;

    @Column(name = "is_solved", nullable = false)
    @Builder.Default
    private boolean solved = false;

    @Column(name = "penalty_minutes", nullable = false)
    @Builder.Default
    private int penaltyMinutes = 0;

    /**
     * Optimistic-lock backstop. The hot path locks this row pessimistically
     * ({@code findForUpdate}), but @Version protects any non-locked write path
     * and lets callers retry on a lost update under concurrent submissions.
     */
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private long version = 0;
}
