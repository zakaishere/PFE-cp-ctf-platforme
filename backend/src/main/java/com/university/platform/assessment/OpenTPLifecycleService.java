package com.university.platform.assessment;

import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.JoinRequestRepository;
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
public class OpenTPLifecycleService {

    private final AssessmentRepository assessmentRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void handleExpiredOpenTPs() {
        LocalDateTime now = LocalDateTime.now();
        List<OpenTP> expiredTPs = assessmentRepository
                .findOpenTPsPastDeadlineWithPendingRequests(now, JoinRequestStatus.PENDING);

        for (OpenTP tp : expiredTPs) {
            String rejectionReason = "The assignment deadline has passed.";
            List<JoinRequest> pending = joinRequestRepository
                    .findByAssessmentIdAndStatus(tp.getAssessmentId(), JoinRequestStatus.PENDING);

            for (JoinRequest jr : pending) {
                // Idempotent: only process if still PENDING
                if (jr.getStatus() != JoinRequestStatus.PENDING) continue;

                jr.setStatus(JoinRequestStatus.REJECTED);
                jr.setRejectionReason(rejectionReason);
                jr.setDecidedAt(now);
                joinRequestRepository.save(jr);

                pushRejectionToStudent(jr.getStudentId(), tp.getTitle(),
                        tp.getAssessmentId().toString(), rejectionReason);
                emailService.sendJoinRequestRejected(
                        jr.getStudentId(), tp.getTitle(), rejectionReason);
            }

            if (!pending.isEmpty()) {
                log.info("[OPENTP_LIFECYCLE] Auto-rejected {} pending join requests for TP {}",
                        pending.size(), tp.getAssessmentId());
            }
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
                           "isCompetition", false,
                           "reason", reason));
        } catch (Exception ex) {
            log.warn("[OPENTP_LIFECYCLE] Failed to push rejection to student {}: {}",
                    studentId, ex.getMessage());
        }
    }
}
