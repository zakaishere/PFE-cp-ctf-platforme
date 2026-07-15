package com.university.platform.competition.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Full competition scoreboard, mode-aware (ICPC / RATED / PARTIAL).
 * Drives the unified CPScoreboard frontend component.
 */
@Data
@Builder
public class ScoreboardDTO {

    private UUID competitionId;
    private String scoringMode;          // ICPC | RATED | PARTIAL
    private String mode;                 // SOLO | TEAM
    private boolean frozen;              // true → these standings are a freeze snapshot
    private String freezeAt;             // ISO timestamp of freeze, or null
    private List<ProblemColumn> problems;
    private List<Row> rows;

    @Data
    @Builder
    public static class ProblemColumn {
        private UUID problemId;
        private String label;            // A, B, C…
        private String title;
        private int maxPoints;
        private UUID firstBloodParticipantId;
    }

    @Data
    @Builder
    public static class Row {
        private int rank;
        private UUID participantId;       // teamId (TEAM) or studentId (SOLO)
        private String name;              // team name or student full name
        private List<MemberDTO> members;  // TEAM only; null/empty for SOLO
        private int score;                // ICPC: #solved · RATED/PARTIAL: total points
        private int penaltyMinutes;       // ICPC only
        private int solvedCount;
        private Map<String, ProblemCellDTO> cells;  // keyed by problemId string
    }

    @Data
    @Builder
    public static class MemberDTO {
        private UUID studentId;
        private String firstName;
        private String lastName;
    }

    @Data
    @Builder
    public static class ProblemCellDTO {
        private boolean solved;
        private boolean attempted;
        private int wrongAttempts;
        private int score;                // RATED / PARTIAL
        private int penaltyMinutes;       // ICPC
        private boolean firstBlood;
        private Integer solvedAtMinute;   // minutes since competition start, or null
    }
}
