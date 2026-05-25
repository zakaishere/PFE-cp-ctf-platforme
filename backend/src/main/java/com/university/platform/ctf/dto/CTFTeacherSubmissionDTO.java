package com.university.platform.ctf.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One row in the teacher Submissions tab. Built from {@code CTFCompetitionSolve}
 * — note the competition flow doesn't persist incorrect attempts, so this log
 * effectively shows correct solves; cheat events surface separately.
 */
@Data
@Builder
public class CTFTeacherSubmissionDTO {
    private UUID id;
    private UUID teamId;
    private String teamName;
    private String avatarColor;
    private UUID challengeId;
    private String challengeTitle;
    private String challengeCategory;
    private UUID solvedByUserId;
    private String solvedByName;
    private int pointsAwarded;
    private boolean correct;
    private LocalDateTime at;
}
