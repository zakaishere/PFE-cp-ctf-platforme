package com.university.platform.competition.model;

import com.university.platform.assessment.VisibilityMode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "competitions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Competition {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "competition_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID competitionId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_by", nullable = false, columnDefinition = "uuid")
    private UUID createdBy;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 10)
    @Builder.Default
    private CompetitionMode mode = CompetitionMode.SOLO;

    @Column(name = "max_team_size")
    @Builder.Default
    private Integer maxTeamSize = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private CompetitionStatus status = CompetitionStatus.DRAFT;

    @Column(name = "is_public", nullable = false)
    @Builder.Default
    private boolean isPublic = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_mode", nullable = false, length = 20)
    @Builder.Default
    private VisibilityMode visibilityMode = VisibilityMode.REQUEST_BASED;

    @Column(name = "penalty_enabled", nullable = false)
    @Builder.Default
    private boolean penaltyEnabled = false;

    @Column(name = "penalty_minutes")
    @Builder.Default
    private Integer penaltyMinutes = 10;

    @Column(name = "min_team_size")
    @Builder.Default
    private Integer minTeamSize = 1;

    // ── Scoring mode + scoreboard freeze (migration v22) ────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_mode", nullable = false, length = 8)
    @Builder.Default
    private ScoringMode scoringMode = ScoringMode.ICPC;

    /** Absolute moment the public scoreboard freezes. Null = never freezes. */
    @Column(name = "freeze_at")
    private LocalDateTime freezeAt;

    @Column(name = "freeze_duration_minutes")
    @Builder.Default
    private Integer freezeDurationMinutes = 60;

    public enum CompetitionMode { SOLO, TEAM }

    public enum CompetitionStatus { DRAFT, REGISTRATION, ACTIVE, ENDED }

    public enum ScoringMode { ICPC, RATED, PARTIAL }

    /** Competition end = start + duration. */
    public LocalDateTime getEndTime() {
        return startTime != null ? startTime.plusMinutes(durationMinutes) : null;
    }

    /**
     * True while the public scoreboard should be hidden: after freezeAt and
     * before the competition ends. Teachers bypass this; students do not.
     */
    public boolean isScoreboardFrozen() {
        if (freezeAt == null) return false;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime end = getEndTime();
        return now.isAfter(freezeAt) && (end == null || now.isBefore(end));
    }
}
