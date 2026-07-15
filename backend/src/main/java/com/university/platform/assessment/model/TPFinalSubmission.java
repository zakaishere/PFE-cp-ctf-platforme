package com.university.platform.assessment.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A student's final "Submit TP" action. Once a row exists for
 * (assessment, student), that student's submissions to the TP are locked and
 * the arena shows the read-only results view. Per-student by design — see
 * migration_v31.
 */
@Entity
@Table(
    name = "tp_final_submissions",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_tp_final_submission",
        columnNames = {"assessment_id", "student_id"}
    ),
    indexes = @Index(name = "idx_tp_final_assessment_student",
                     columnList = "assessment_id, student_id")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TPFinalSubmission {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "assessment_id", nullable = false, columnDefinition = "uuid")
    private UUID assessmentId;

    @Column(name = "student_id", nullable = false, columnDefinition = "uuid")
    private UUID studentId;

    @Column(name = "submitted_at", nullable = false)
    @Builder.Default
    private LocalDateTime submittedAt = LocalDateTime.now();
}
