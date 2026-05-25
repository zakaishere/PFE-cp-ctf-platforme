package com.university.platform.assessment.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.UUID;

@Entity
@Table(
    name = "exam_problems",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_ep_exam_problem", columnNames = {"live_exam_id", "problem_id"})
    },
    indexes = {
        @Index(name = "idx_ep_live_exam_id", columnList = "live_exam_id"),
        @Index(name = "idx_ep_problem_id",   columnList = "problem_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamProblem {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "live_exam_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_ep_live_exam")
    )
    private LiveExam liveExam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "problem_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_ep_problem")
    )
    private Problem problem;

    @Builder.Default
    @Column(name = "base_points", nullable = false)
    private Integer basePoints = 500;
}
