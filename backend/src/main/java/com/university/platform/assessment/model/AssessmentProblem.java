package com.university.platform.assessment.model;
import com.university.platform.execution.model.Result;
import com.university.platform.execution.model.Result.ResultStatus;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.UUID;

@Entity
@Table(
    name = "assessment_problems",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_ap_assessment_problem",    columnNames = {"assessment_id", "problem_id"}),
        @UniqueConstraint(name = "uq_ap_assessment_order",      columnNames = {"assessment_id", "order_index"})
    },
    indexes = {
        @Index(name = "idx_ap_assessment_id", columnList = "assessment_id"),
        @Index(name = "idx_ap_problem_id",    columnList = "problem_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentProblem {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "assessment_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_ap_assessment")
    )
    private Assessment assessment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "problem_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_ap_problem")
    )
    private Problem problem;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "points_override")
    private Integer pointsOverride;
}
