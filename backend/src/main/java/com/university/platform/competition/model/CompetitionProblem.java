package com.university.platform.competition.model;

import com.university.platform.assessment.model.Problem;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "competition_problems",
    uniqueConstraints = @UniqueConstraint(name = "uq_cp_competition_problem", columnNames = {"competition_id", "problem_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompetitionProblem {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "competition_id", nullable = false, columnDefinition = "uuid")
    private UUID competitionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "problem_id", nullable = false, foreignKey = @ForeignKey(name = "fk_cp_problem"))
    private Problem problem;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "points", nullable = false)
    private int points;

    // ── Per-problem scoring config (migration v22) ──────────────────────────

    @Column(name = "max_points")
    @Builder.Default
    private int maxPoints = 100;

    @Column(name = "min_points")
    @Builder.Default
    private int minPoints = 0;

    @Column(name = "decay_per_min")
    @Builder.Default
    private BigDecimal decayPerMin = new BigDecimal("1.0");

    @Column(name = "wrong_penalty")
    @Builder.Default
    private int wrongPenalty = 20;

    /** First participant (team or solo student) to fully solve this problem. */
    @Column(name = "first_blood_participant_id")
    private UUID firstBloodParticipantId;

    @Column(name = "first_blood_at")
    private LocalDateTime firstBloodAt;
}
