package com.university.platform.competition.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "competition_teams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Team {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "team_id", updatable = false, nullable = false, columnDefinition = "uuid")
    private UUID teamId;

    @Column(name = "competition_id", nullable = false, columnDefinition = "uuid")
    private UUID competitionId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "invite_code", nullable = false, length = 10)
    private String inviteCode;

    @Column(name = "captain_id", nullable = false, columnDefinition = "uuid")
    private UUID captainId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    @Builder.Default
    private TeamStatus status = TeamStatus.FORMING;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum TeamStatus { FORMING, LOCKED }
}
