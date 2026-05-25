package com.university.platform.assessment;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "join_requests",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_join_req_assessment_student",
                columnNames = {"assessment_id", "student_id"}),
        @UniqueConstraint(name = "uq_join_req_competition_student",
                columnNames = {"competition_id", "student_id"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinRequest {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "assessment_id", nullable = true, columnDefinition = "uuid")
    private UUID assessmentId;

    @Column(name = "competition_id", nullable = true, columnDefinition = "uuid")
    private UUID competitionId;

    @Column(name = "student_id", nullable = false, columnDefinition = "uuid")
    private UUID studentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private JoinRequestStatus status = JoinRequestStatus.PENDING;

    @Column(length = 500)
    private String message;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "decided_at", nullable = true)
    private LocalDateTime decidedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @PrePersist
    private void validate() {
        boolean hasAssessment = assessmentId != null;
        boolean hasCompetition = competitionId != null;
        if (hasAssessment == hasCompetition) {
            throw new IllegalStateException(
                    "Exactly one of assessmentId or competitionId must be set");
        }
    }
}
