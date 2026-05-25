package com.university.platform.assessment.dto;

import java.util.List;
import java.util.UUID;

public record ExamRoomDTO(
    UUID assessmentId,
    String title,
    long remainingSeconds,
    boolean isEnded,
    List<ExamProblemDTO> problems
) {}
