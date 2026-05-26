package com.university.platform.ctf.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CTFChallengeSolverDTO {
    private UUID teamId;
    private String teamName;
    private String avatarColor;
    private LocalDateTime solvedAt;
}
