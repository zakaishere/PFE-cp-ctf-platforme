package com.university.platform.competition.service;

import com.university.platform.assessment.JoinRequest;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.competition.model.Team;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.competition.repository.TeamRepository;
import com.university.platform.identity.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitionLifecycleService {

    private final CompetitionRepository competitionRepository;
    private final TeamRepository teamRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void checkCompetitionTransitions() {
        LocalDateTime now = LocalDateTime.now();

        // REGISTRATION → ACTIVE: startTime has arrived
        List<Competition> toActivate = competitionRepository
                .findByStatusAndStartTimeOnOrBefore(CompetitionStatus.REGISTRATION, now);

        for (Competition comp : toActivate) {
            comp.setStatus(CompetitionStatus.ACTIVE);
            competitionRepository.save(comp);

            // Lock all teams
            List<Team> teams = teamRepository.findByCompetitionId(comp.getCompetitionId());
            for (Team team : teams) {
                team.setStatus(Team.TeamStatus.LOCKED);
            }
            if (!teams.isEmpty()) {
                teamRepository.saveAll(teams);
            }

            // Auto-reject any still-pending join requests
            String rejectionReason =
                    "Competition has started. Your request was not approved in time.";
            List<JoinRequest> pending =
                    joinRequestRepository.findByCompetitionIdAndStatus(
                            comp.getCompetitionId(), JoinRequestStatus.PENDING);
            for (JoinRequest jr : pending) {
                jr.setStatus(JoinRequestStatus.REJECTED);
                jr.setRejectionReason(rejectionReason);
                jr.setDecidedAt(LocalDateTime.now());
                joinRequestRepository.save(jr);
                pushRejectionToStudent(jr.getStudentId(), comp.getTitle(),
                        comp.getCompetitionId().toString(), rejectionReason);
                emailService.sendJoinRequestRejected(
                        jr.getStudentId(), comp.getTitle(), rejectionReason);
            }
            if (!pending.isEmpty()) {
                log.info("[LIFECYCLE] Auto-rejected {} pending join requests for competition {}",
                        pending.size(), comp.getCompetitionId());
            }

            pushStatusUpdate(comp.getCompetitionId().toString(), "ACTIVE");
            log.info("[LIFECYCLE] Competition {} → ACTIVE, locked {} teams",
                    comp.getCompetitionId(), teams.size());
        }

        // ACTIVE → ENDED: startTime + durationMinutes has passed
        List<Competition> active = competitionRepository.findByStatus(CompetitionStatus.ACTIVE);
        for (Competition comp : active) {
            LocalDateTime endTime = comp.getStartTime().plusMinutes(comp.getDurationMinutes());
            if (!now.isBefore(endTime)) {
                comp.setStatus(CompetitionStatus.ENDED);
                competitionRepository.save(comp);
                pushStatusUpdate(comp.getCompetitionId().toString(), "ENDED");
                log.info("[LIFECYCLE] Competition {} → ENDED", comp.getCompetitionId());
            }
        }
    }

    private void pushStatusUpdate(String competitionId, String status) {
        try {
            messagingTemplate.convertAndSend(
                    "/topic/competitions/" + competitionId + "/status",
                    Map.of("status", status)
            );
        } catch (Exception ex) {
            log.warn("[LIFECYCLE] Failed to push status update for {}: {}", competitionId, ex.getMessage());
        }
    }

    private void pushRejectionToStudent(java.util.UUID studentId, String targetTitle,
                                         String targetId, String reason) {
        try {
            messagingTemplate.convertAndSend(
                    "/topic/students/" + studentId + "/notifications",
                    Map.of("type", "JOIN_REQUEST_REJECTED",
                           "targetTitle", targetTitle,
                           "targetId", targetId,
                           "isCompetition", true,
                           "reason", reason));
        } catch (Exception ex) {
            log.warn("[LIFECYCLE] Failed to push rejection to student {}: {}", studentId, ex.getMessage());
        }
    }
}
