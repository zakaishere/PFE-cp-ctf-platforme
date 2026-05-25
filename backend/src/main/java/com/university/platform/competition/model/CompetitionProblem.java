package com.university.platform.competition.model;

import com.university.platform.assessment.model.Problem;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

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
}
