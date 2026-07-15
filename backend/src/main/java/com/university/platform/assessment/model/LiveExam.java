package com.university.platform.assessment.model;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "live_exams",
    indexes = {
        @Index(name = "idx_live_exams_start_time", columnList = "scheduled_start_time")
    }
)
@DiscriminatorValue("LIVE_EXAM")
@PrimaryKeyJoinColumn(name = "assessment_id")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class LiveExam extends Assessment {

    @Column(name = "scheduled_start_time", nullable = false)
    private LocalDateTime scheduledStartTime;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "strict_access_code", nullable = false, length = 100)
    private String strictAccessCode;

    @Column(name = "is_penalty_enabled")
    @Builder.Default
    private Boolean isPenaltyEnabled = true;

    @Column(name = "is_closed", nullable = false)
    @Builder.Default
    private Boolean isClosed = false;

    /**
     * Whether final grades/verdicts are visible to students. Kept separate from
     * {@link #isClosed} so a teacher can close an exam (stop submissions) before
     * releasing results. Column added by migration_v23.
     */
    @Column(name = "grades_revealed", nullable = false)
    @Builder.Default
    private Boolean gradesRevealed = false;

    /** Pass threshold as a percentage of total points (0–100). Defaults to 50. Column added by migration_v23. */
    @Column(name = "passing_score", nullable = false)
    @Builder.Default
    private Integer passingScore = 50;

    /** LAST_SUBMISSION (final answer counts) or BEST_SUBMISSION (default, current behavior). */
    @Column(name = "scoring_mode", nullable = false, length = 20)
    @Builder.Default
    private String scoringMode = "BEST_SUBMISSION";
}
