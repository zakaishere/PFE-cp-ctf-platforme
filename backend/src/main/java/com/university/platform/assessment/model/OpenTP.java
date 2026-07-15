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

    @Column(name = "strict_access_code", length = 100)
    private String strictAccessCode;

    /** BEST_SUBMISSION (default; NO_PENALTY is the same mode, just a friendlier
     *  label the UI can offer) or ATTEMPT_PENALTY (deduct % per failed attempt). */
    @Column(name = "scoring_mode", nullable = false, length = 20)
    @Builder.Default
    private String scoringMode = "BEST_SUBMISSION";

    /** Percent deducted per failed attempt before solving, when scoringMode is ATTEMPT_PENALTY. */
    @Column(name = "penalty_percent", nullable = false)
    @Builder.Default
    private Integer penaltyPercent = 0;
}
