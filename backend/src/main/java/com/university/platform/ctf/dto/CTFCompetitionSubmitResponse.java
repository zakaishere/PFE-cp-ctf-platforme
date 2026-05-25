package com.university.platform.ctf.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CTFCompetitionSubmitResponse {
    private boolean correct;
    private String message;
    private Integer pointsAwarded;
    private Integer newRank;
}
