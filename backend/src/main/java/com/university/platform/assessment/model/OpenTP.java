package com.university.platform.assessment.model;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "open_tps",
    indexes = {
        @Index(name = "idx_open_tps_deadline", columnList = "deadline")
    }
)
@DiscriminatorValue("OPEN_TP")
@PrimaryKeyJoinColumn(name = "assessment_id")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class OpenTP extends Assessment {

    @Column(name = "deadline", nullable = false)
    private LocalDateTime deadline;

    @Column(name = "max_attempts_allowed")
    private Integer maxAttemptsAllowed;
}
