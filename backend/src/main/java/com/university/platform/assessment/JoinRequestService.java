package com.university.platform.assessment;

import com.university.platform.assessment.dto.JoinRequestCountDTO;
import com.university.platform.assessment.dto.JoinRequestDTO;
import com.university.platform.assessment.dto.JoinRequestStatusDTO;
import com.university.platform.assessment.dto.MyJoinRequestDTO;
import com.university.platform.assessment.model.Assessment;
import com.university.platform.assessment.model.LiveExam;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.repository.JoinRequestRepository;
import com.university.platform.competition.model.Competition;
import com.university.platform.competition.model.Competition.CompetitionStatus;
import com.university.platform.competition.model.CompetitionRegistration;
import com.university.platform.competition.repository.CompetitionRegistrationRepository;
import com.university.platform.competition.repository.CompetitionRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.service.EmailService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class JoinRequestService {

    private final JoinRequestRepository joinRequestRepository;
    private final AssessmentRepository assessmentRepository;
    private final CompetitionRepository competitionRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final StudentRepository studentRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;

    @Transactional
    public Map<String, Object> requestToJoin(UUID targetId, boolean isCompetition,
                                              UUID studentId, String message) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new EntityNotFoundException("Student not found: " + studentId));

        String targetTitle;
        if (isCompetition) {
            Competition competition = competitionRepository.findById(targetId)
                    .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + targetId));

            if (competition.getVisibilityMode() != VisibilityMode.REQUEST_BASED) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This assessment does not accept join requests.");
            }
            if (competition.getStatus() != CompetitionStatus.REGISTRATION) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Join requests can only be submitted during the registration phase.");
            }
            joinRequestRepository.findByCompetitionIdAndStudentId(targetId, studentId)
                    .ifPresent(jr -> {
                        if (jr.getStatus() == JoinRequestStatus.REJECTED) {
                            throw new ResponseStatusException(HttpStatus.CONFLICT,
                                    "Your request was rejected and cannot be resubmitted. Contact the organizer.");
                        }
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "You have already submitted a request for this assessment.");
                    });

            targetTitle = competition.getTitle();
            JoinRequest jr = JoinRequest.builder()
                    .competitionId(targetId)
                    .studentId(studentId)
                    .message(message)
                    .requestedAt(LocalDateTime.now())
                    .build();
            jr = joinRequestRepository.save(jr);

            pushNewRequestToTeacher("/topic/competitions/" + targetId + "/join-requests",
                    jr.getId(), student);
            return Map.of("message", "Request submitted successfully.", "requestId", jr.getId());
        } else {
            Assessment assessment = assessmentRepository.findById(targetId)
                    .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + targetId));

            if (assessment.getVisibilityMode() != VisibilityMode.REQUEST_BASED) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This assessment does not accept join requests.");
            }
            validateAssessmentOpen(assessment);

            joinRequestRepository.findByAssessmentIdAndStudentId(targetId, studentId)
                    .ifPresent(jr -> {
                        if (jr.getStatus() == JoinRequestStatus.REJECTED) {
                            throw new ResponseStatusException(HttpStatus.CONFLICT,
                                    "Your request was rejected and cannot be resubmitted. Contact the organizer.");
                        }
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "You have already submitted a request for this assessment.");
                    });

            targetTitle = assessment.getTitle();
            JoinRequest jr = JoinRequest.builder()
                    .assessmentId(targetId)
                    .studentId(studentId)
                    .message(message)
                    .requestedAt(LocalDateTime.now())
                    .build();
            jr = joinRequestRepository.save(jr);

            pushNewRequestToTeacher("/topic/assessments/" + targetId + "/join-requests",
                    jr.getId(), student);
            return Map.of("message", "Request submitted successfully.", "requestId", jr.getId());
        }
    }

    @Transactional(readOnly = true)
    public JoinRequestStatusDTO getMyStatus(UUID targetId, boolean isCompetition, UUID studentId) {
        Optional<JoinRequest> jr = isCompetition
                ? joinRequestRepository.findByCompetitionIdAndStudentId(targetId, studentId)
                : joinRequestRepository.findByAssessmentIdAndStudentId(targetId, studentId);

        return jr.map(r -> new JoinRequestStatusDTO(r.getStatus().name(), r.getRejectionReason()))
                .orElse(new JoinRequestStatusDTO("NOT_REQUESTED", null));
    }

    @Transactional(readOnly = true)
    public Page<JoinRequestDTO> getPendingRequests(UUID targetId, boolean isCompetition,
                                                    JoinRequestStatus status, Pageable pageable,
                                                    UUID actorId, boolean isAdmin) {
        verifyOwnership(targetId, isCompetition, actorId, isAdmin);

        Page<JoinRequest> page = isCompetition
                ? joinRequestRepository.findByCompetitionIdAndStatus(targetId, status, pageable)
                : joinRequestRepository.findByAssessmentIdAndStatus(targetId, status, pageable);

        return page.map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public JoinRequestCountDTO getCount(UUID targetId, boolean isCompetition,
                                         UUID actorId, boolean isAdmin) {
        verifyOwnership(targetId, isCompetition, actorId, isAdmin);

        long pending, approved, rejected;
        if (isCompetition) {
            pending  = joinRequestRepository.countByCompetitionIdAndStatus(targetId, JoinRequestStatus.PENDING);
            approved = joinRequestRepository.countByCompetitionIdAndStatus(targetId, JoinRequestStatus.APPROVED);
            rejected = joinRequestRepository.countByCompetitionIdAndStatus(targetId, JoinRequestStatus.REJECTED);
        } else {
            pending  = joinRequestRepository.countByAssessmentIdAndStatus(targetId, JoinRequestStatus.PENDING);
            approved = joinRequestRepository.countByAssessmentIdAndStatus(targetId, JoinRequestStatus.APPROVED);
            rejected = joinRequestRepository.countByAssessmentIdAndStatus(targetId, JoinRequestStatus.REJECTED);
        }
        return JoinRequestCountDTO.builder()
                .pending(pending)
                .approved(approved)
                .rejected(rejected)
                .total(pending + approved + rejected)
                .build();
    }

    @Transactional
    public Map<String, Object> approveRequest(UUID requestId, UUID actorId, boolean isAdmin) {
        JoinRequest jr = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Join request not found: " + requestId));

        boolean isComp = jr.getCompetitionId() != null;
        verifyOwnership(isComp ? jr.getCompetitionId() : jr.getAssessmentId(), isComp, actorId, isAdmin);

        if (jr.getStatus() == JoinRequestStatus.APPROVED) {
            return Map.of("message", "Request is already approved.");
        }

        boolean wasRejectedBefore = jr.getStatus() == JoinRequestStatus.REJECTED;

        jr.setStatus(JoinRequestStatus.APPROVED);
        jr.setRejectionReason(null);
        jr.setDecidedAt(LocalDateTime.now());
        joinRequestRepository.save(jr);

        // Option A: approval marks the student as registered for the competition.
        // The student joins/creates a team later in the lobby (teamId stays null
        // until then). Registration is what gates lobby/arena access for SOLO
        // REQUEST_BASED competitions and drives the registered count. Idempotent.
        if (isComp) {
            UUID compId = jr.getCompetitionId();
            if (!competitionRegistrationRepository.existsByCompetitionIdAndStudentId(compId, jr.getStudentId())) {
                competitionRegistrationRepository.save(
                        CompetitionRegistration.builder()
                                .competitionId(compId)
                                .studentId(jr.getStudentId())
                                .build());
                log.info("[JOIN_REQUEST] Created competition registration for student {} in competition {}",
                        jr.getStudentId(), compId);
            }
        }

        String targetTitle = loadTitle(jr);
        UUID targetId = isComp ? jr.getCompetitionId() : jr.getAssessmentId();
        String targetType = resolveTargetType(jr);
        LocalDateTime startTime = resolveStartTime(jr);

        pushDecisionToStudent(jr.getStudentId(), "JOIN_REQUEST_APPROVED",
                targetTitle, targetId, isComp, null);

        emailService.sendJoinRequestApproved(
                jr.getStudentId(), targetTitle, targetType, startTime, wasRejectedBefore);

        String msg = wasRejectedBefore
                ? "Request approved (previous rejection reversed)."
                : "Request approved.";
        log.info("[JOIN_REQUEST] Approved request {} for student {} (wasRejected={})",
                requestId, jr.getStudentId(), wasRejectedBefore);
        return Map.of("message", msg);
    }

    @Transactional
    public Map<String, Object> rejectRequest(UUID requestId, UUID actorId, boolean isAdmin, String reason) {
        JoinRequest jr = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException("Join request not found: " + requestId));

        boolean isComp = jr.getCompetitionId() != null;
        verifyOwnership(isComp ? jr.getCompetitionId() : jr.getAssessmentId(), isComp, actorId, isAdmin);

        if (jr.getStatus() == JoinRequestStatus.REJECTED) {
            return Map.of("message", "Request rejected.");
        }
        if (jr.getStatus() == JoinRequestStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reject an already approved request.");
        }

        jr.setStatus(JoinRequestStatus.REJECTED);
        jr.setRejectionReason(reason);
        jr.setDecidedAt(LocalDateTime.now());
        joinRequestRepository.save(jr);

        String targetTitle = loadTitle(jr);
        UUID targetId = isComp ? jr.getCompetitionId() : jr.getAssessmentId();
        pushDecisionToStudent(jr.getStudentId(), "JOIN_REQUEST_REJECTED",
                targetTitle, targetId, isComp, reason);

        emailService.sendJoinRequestRejected(jr.getStudentId(), targetTitle, reason);

        log.info("[JOIN_REQUEST] Rejected request {} for student {}", requestId, jr.getStudentId());
        return Map.of("message", "Request rejected.");
    }

    @Transactional
    public Map<String, Object> bulkApprove(UUID targetId, boolean isCompetition,
                                            List<UUID> requestIds, UUID actorId, boolean isAdmin) {
        verifyOwnership(targetId, isCompetition, actorId, isAdmin);

        int approved = 0;
        int failed = 0;
        for (UUID requestId : requestIds) {
            try {
                approveRequest(requestId, actorId, isAdmin);
                approved++;
            } catch (Exception e) {
                log.warn("[JOIN_REQUEST] Bulk approve failed for request {}: {}", requestId, e.getMessage());
                failed++;
            }
        }
        return Map.of("approved", approved, "failed", failed,
                "message", "Bulk approve completed: " + approved + " approved, " + failed + " failed.");
    }

    @Transactional
    public Map<String, Object> bulkApproveByDivision(UUID targetId, boolean isCompetition,
                                                       UUID divisionId, UUID actorId, boolean isAdmin) {
        verifyOwnership(targetId, isCompetition, actorId, isAdmin);

        List<JoinRequest> pending = isCompetition
                ? joinRequestRepository.findByCompetitionIdAndStatusAndStudentDivisionId(
                        targetId, JoinRequestStatus.PENDING, divisionId)
                : joinRequestRepository.findByAssessmentIdAndStatusAndStudentDivisionId(
                        targetId, JoinRequestStatus.PENDING, divisionId);

        int approved = 0;
        for (JoinRequest jr : pending) {
            try {
                approveRequest(jr.getId(), actorId, isAdmin);
                approved++;
            } catch (Exception e) {
                log.warn("[JOIN_REQUEST] Bulk-by-division approve failed for request {}: {}",
                        jr.getId(), e.getMessage());
            }
        }
        return Map.of("approved", approved,
                "message", approved + " requests approved for division.");
    }

    // Patch 3 — Student "My Requests"
    @Transactional(readOnly = true)
    public Page<MyJoinRequestDTO> getMyRequests(UUID studentId,
                                                  JoinRequestStatus statusFilter,
                                                  Pageable pageable) {
        Page<JoinRequest> page = statusFilter != null
                ? joinRequestRepository.findByStudentIdAndStatus(studentId, statusFilter, pageable)
                : joinRequestRepository.findByStudentId(studentId, pageable);

        return page.map(jr -> {
            UUID targetId;
            String targetTitle;
            String targetType;
            String targetStatus;
            LocalDateTime startTime = null;
            LocalDateTime deadline = null;

            if (jr.getAssessmentId() != null) {
                targetId = jr.getAssessmentId();
                Assessment assessment = assessmentRepository.findById(targetId).orElse(null);
                if (assessment instanceof LiveExam exam) {
                    targetTitle = exam.getTitle();
                    targetType = "LIVE_EXAM";
                    startTime = exam.getScheduledStartTime();
                    LocalDateTime end = startTime.plusMinutes(exam.getDurationMinutes());
                    boolean closed = Boolean.TRUE.equals(exam.getIsClosed())
                            || LocalDateTime.now().isAfter(end);
                    targetStatus = closed ? "CLOSED" : "OPEN";
                } else if (assessment instanceof OpenTP tp) {
                    targetTitle = tp.getTitle();
                    targetType = "OPEN_TP";
                    deadline = tp.getDeadline();
                    targetStatus = LocalDateTime.now().isAfter(deadline) ? "CLOSED" : "OPEN";
                } else {
                    targetTitle = assessment != null ? assessment.getTitle() : "Unknown";
                    targetType = "ASSESSMENT";
                    targetStatus = "UNKNOWN";
                }
            } else {
                targetId = jr.getCompetitionId();
                Competition competition = competitionRepository.findById(targetId).orElse(null);
                targetTitle = competition != null ? competition.getTitle() : "Unknown";
                targetType = "COMPETITION";
                targetStatus = competition != null ? competition.getStatus().name() : "UNKNOWN";
                startTime = competition != null ? competition.getStartTime() : null;
            }

            return MyJoinRequestDTO.builder()
                    .requestId(jr.getId())
                    .targetId(targetId)
                    .targetTitle(targetTitle)
                    .targetType(targetType)
                    .targetStatus(targetStatus)
                    .startTime(startTime)
                    .deadline(deadline)
                    .myRequestStatus(jr.getStatus().name())
                    .rejectionReason(jr.getRejectionReason())
                    .requestedAt(jr.getRequestedAt())
                    .decidedAt(jr.getDecidedAt())
                    .build();
        });
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void validateAssessmentOpen(Assessment assessment) {
        LocalDateTime now = LocalDateTime.now();
        if (assessment instanceof LiveExam exam) {
            LocalDateTime end = exam.getScheduledStartTime().plusMinutes(exam.getDurationMinutes());
            if (now.isAfter(end)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This exam is already closed.");
            }
        } else if (assessment instanceof OpenTP tp) {
            if (now.isAfter(tp.getDeadline())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "The deadline for this TP has passed.");
            }
        }
    }

    private void verifyOwnership(UUID targetId, boolean isCompetition, UUID actorId, boolean isAdmin) {
        if (isAdmin) return;
        if (isCompetition) {
            Competition competition = competitionRepository.findById(targetId)
                    .orElseThrow(() -> new EntityNotFoundException("Competition not found: " + targetId));
            if (!competition.getCreatedBy().equals(actorId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Only the creator can manage requests for this competition.");
            }
        } else {
            Assessment assessment = assessmentRepository.findById(targetId)
                    .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + targetId));
            if (!assessment.getCreatedBy().getId().equals(actorId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Only the creator can manage requests for this assessment.");
            }
        }
    }

    private String loadTitle(JoinRequest jr) {
        if (jr.getAssessmentId() != null) {
            return assessmentRepository.findById(jr.getAssessmentId())
                    .map(Assessment::getTitle).orElse("Unknown");
        } else {
            return competitionRepository.findById(jr.getCompetitionId())
                    .map(Competition::getTitle).orElse("Unknown");
        }
    }

    private JoinRequestDTO toDTO(JoinRequest jr) {
        Student student    = studentRepository.findById(jr.getStudentId()).orElse(null);
        String firstName   = student != null ? student.getFirstName()  : "Unknown";
        String lastName    = student != null ? student.getLastName()   : "";
        String email       = student != null ? student.getEmail()      : "";
        String apogee      = (student != null && student.getApogeeNumber() != null)
                ? student.getApogeeNumber() : "";
        String divName     = (student != null && student.getDivision() != null)
                ? student.getDivision().getName() : "";
        String semName     = (student != null && student.getSemester() != null)
                ? student.getSemester().getName() : "";

        log.debug("[DTO_MAP] studentId={} name='{} {}' apogee='{}' division='{}'",
                jr.getStudentId(), firstName, lastName, apogee, divName);

        return JoinRequestDTO.builder()
                .requestId(jr.getId())
                .studentId(jr.getStudentId())
                .firstName(firstName)
                .lastName(lastName)
                .email(email)
                .apogeeNumber(apogee)
                .divisionName(divName)
                .semesterName(semName)
                .message(jr.getMessage())
                .status(jr.getStatus())
                .rejectionReason(jr.getRejectionReason())
                .requestedAt(jr.getRequestedAt())
                .decidedAt(jr.getDecidedAt())
                .build();
    }

    private void pushNewRequestToTeacher(String destination, UUID requestId, Student student) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "NEW_REQUEST");
            payload.put("requestId", requestId);
            payload.put("studentId", student.getId());
            payload.put("firstName", student.getFirstName());
            payload.put("lastName", student.getLastName());
            payload.put("divisionName", student.getDivision() != null ? student.getDivision().getName() : "");
            payload.put("requestedAt", LocalDateTime.now().toString());
            messagingTemplate.convertAndSend(destination, payload);
        } catch (Exception e) {
            log.warn("[JOIN_REQUEST] Failed to push new-request notification: {}", e.getMessage());
        }
    }

    private String resolveTargetType(JoinRequest jr) {
        if (jr.getAssessmentId() != null) {
            Assessment a = assessmentRepository.findById(jr.getAssessmentId()).orElse(null);
            if (a instanceof LiveExam) return "Live Exam";
            if (a instanceof OpenTP)   return "Open TP";
            return "Assessment";
        }
        return "Competition";
    }

    private LocalDateTime resolveStartTime(JoinRequest jr) {
        if (jr.getAssessmentId() != null) {
            Assessment a = assessmentRepository.findById(jr.getAssessmentId()).orElse(null);
            if (a instanceof LiveExam exam) return exam.getScheduledStartTime();
            return null;
        }
        return competitionRepository.findById(jr.getCompetitionId())
                .map(Competition::getStartTime).orElse(null);
    }

    private void pushDecisionToStudent(UUID studentId, String type, String targetTitle,
                                        UUID targetId, boolean isCompetition, String reason) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("targetTitle", targetTitle);
            payload.put("targetId", targetId);
            payload.put("isCompetition", isCompetition);
            if (reason != null) {
                payload.put("reason", reason);
            }
            messagingTemplate.convertAndSend("/topic/students/" + studentId + "/notifications", payload);
        } catch (Exception e) {
            log.warn("[JOIN_REQUEST] Failed to push decision notification to student {}: {}",
                    studentId, e.getMessage());
        }
    }
}
