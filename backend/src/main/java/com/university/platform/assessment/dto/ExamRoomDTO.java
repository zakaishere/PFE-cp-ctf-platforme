package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

public record ExamRoomDTO(
    UUID assessmentId,
    String title,
    long remainingSeconds,
    boolean isEnded,
    List<ExamProblemDTO> problems,
    /** ISO-8601 deadline. Populated for TPs; null for live exams. */
    String deadline,
    /** Max attempts per problem. Populated for TPs (null = unlimited); null for exams. */
    Integer maxAttempts,
    /** Whether final grades/verdicts have been released to the student (live exams). */
    boolean gradesRevealed,
    /** ISO-8601 timestamp of this student's final "Submit TP" action. Null until
     *  they final-submit; always null for live exams. Once set, the TP is
     *  read-only for this student. */
    String finalSubmittedAt
) {}
