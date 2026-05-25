package com.university.platform.competition.dto;

import com.university.platform.competition.model.Team.TeamStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TeamDetailDTO {
    private UUID teamId;
    private String teamName;
    private String inviteCode;
    private UUID captainId;
    private TeamStatus status;
    private List<MemberEntry> members;
    private int currentSize;
    private int maxSize;

    @Data
    @Builder
    public static class MemberEntry {
        private UUID studentId;
        private String firstName;
        private String lastName;
        private LocalDateTime joinedAt;
    }
}
