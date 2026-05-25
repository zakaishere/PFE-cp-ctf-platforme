package com.university.platform.assessment.controller;

import com.university.platform.assessment.JoinRequestService;
import com.university.platform.assessment.JoinRequestStatus;
import com.university.platform.assessment.dto.BulkApproveByDivisionRequestDTO;
import com.university.platform.assessment.dto.BulkApproveRequestDTO;
import com.university.platform.assessment.dto.JoinRequestCountDTO;
import com.university.platform.assessment.dto.JoinRequestDTO;
import com.university.platform.assessment.dto.JoinRequestStatusDTO;
import com.university.platform.assessment.dto.MyJoinRequestDTO;
import com.university.platform.identity.service.JwtService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/join-requests")
@RequiredArgsConstructor
public class JoinRequestController {

    private final JoinRequestService joinRequestService;
    private final JwtService jwtService;

    // -------------------------------------------------------------------------
    // STUDENT: all my requests across assessments and competitions
    // -------------------------------------------------------------------------

    @GetMapping("/mine")
    public ResponseEntity<Page<MyJoinRequestDTO>> getMyRequests(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        JoinRequestStatus statusFilter = (status != null && !status.isBlank())
                ? parseStatus(status)
                : null;
        Pageable pageable = PageRequest.of(page, size);

        return ResponseEntity.ok(joinRequestService.getMyRequests(studentId, statusFilter, pageable));
    }

    // -------------------------------------------------------------------------
    // STUDENT: submit request for assessment
    // -------------------------------------------------------------------------

    @PostMapping("/assessments/{assessmentId}")
    public ResponseEntity<?> requestAssessment(
            @PathVariable UUID assessmentId,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        String message = body != null ? body.get("message") : null;

        Map<String, Object> result = joinRequestService.requestToJoin(assessmentId, false, studentId, message);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // -------------------------------------------------------------------------
    // STUDENT: submit request for competition
    // -------------------------------------------------------------------------

    @PostMapping("/competitions/{competitionId}")
    public ResponseEntity<?> requestCompetition(
            @PathVariable UUID competitionId,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());
        String message = body != null ? body.get("message") : null;

        Map<String, Object> result = joinRequestService.requestToJoin(competitionId, true, studentId, message);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // -------------------------------------------------------------------------
    // STUDENT: check my status for assessment
    // -------------------------------------------------------------------------

    @GetMapping("/assessments/{assessmentId}/my-status")
    public ResponseEntity<JoinRequestStatusDTO> myAssessmentStatus(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        return ResponseEntity.ok(joinRequestService.getMyStatus(assessmentId, false, studentId));
    }

    // -------------------------------------------------------------------------
    // STUDENT: check my status for competition
    // -------------------------------------------------------------------------

    @GetMapping("/competitions/{competitionId}/my-status")
    public ResponseEntity<JoinRequestStatusDTO> myCompetitionStatus(
            @PathVariable UUID competitionId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "STUDENT");
        UUID studentId = UUID.fromString(claims.getSubject());

        return ResponseEntity.ok(joinRequestService.getMyStatus(competitionId, true, studentId));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: list requests for assessment
    // -------------------------------------------------------------------------

    @GetMapping("/assessments/{assessmentId}")
    public ResponseEntity<Page<JoinRequestDTO>> listAssessmentRequests(
            @PathVariable UUID assessmentId,
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        JoinRequestStatus statusEnum = parseStatus(status);
        Pageable pageable = PageRequest.of(page, size);

        return ResponseEntity.ok(
                joinRequestService.getPendingRequests(assessmentId, false, statusEnum, pageable, actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: list requests for competition
    // -------------------------------------------------------------------------

    @GetMapping("/competitions/{competitionId}")
    public ResponseEntity<Page<JoinRequestDTO>> listCompetitionRequests(
            @PathVariable UUID competitionId,
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        JoinRequestStatus statusEnum = parseStatus(status);
        Pageable pageable = PageRequest.of(page, size);

        return ResponseEntity.ok(
                joinRequestService.getPendingRequests(competitionId, true, statusEnum, pageable, actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: count requests for assessment
    // -------------------------------------------------------------------------

    @GetMapping("/assessments/{assessmentId}/count")
    public ResponseEntity<JoinRequestCountDTO> countAssessmentRequests(
            @PathVariable UUID assessmentId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(joinRequestService.getCount(assessmentId, false, actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: count requests for competition
    // -------------------------------------------------------------------------

    @GetMapping("/competitions/{competitionId}/count")
    public ResponseEntity<JoinRequestCountDTO> countCompetitionRequests(
            @PathVariable UUID competitionId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(joinRequestService.getCount(competitionId, true, actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: approve single request
    // -------------------------------------------------------------------------

    @PutMapping("/{requestId}/approve")
    public ResponseEntity<?> approveRequest(
            @PathVariable UUID requestId,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(joinRequestService.approveRequest(requestId, actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: reject single request
    // -------------------------------------------------------------------------

    @PutMapping("/{requestId}/reject")
    public ResponseEntity<?> rejectRequest(
            @PathVariable UUID requestId,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));
        String reason = body != null ? body.get("reason") : null;

        return ResponseEntity.ok(joinRequestService.rejectRequest(requestId, actorId, isAdmin, reason));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: bulk approve for assessment
    // -------------------------------------------------------------------------

    @PutMapping("/assessments/{assessmentId}/bulk-approve")
    public ResponseEntity<?> bulkApproveAssessment(
            @PathVariable UUID assessmentId,
            @RequestBody BulkApproveRequestDTO body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(
                joinRequestService.bulkApprove(assessmentId, false, body.getRequestIds(), actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: bulk approve by division for assessment
    // -------------------------------------------------------------------------

    @PutMapping("/assessments/{assessmentId}/bulk-approve-by-division")
    public ResponseEntity<?> bulkApproveAssessmentByDivision(
            @PathVariable UUID assessmentId,
            @RequestBody BulkApproveByDivisionRequestDTO body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(
                joinRequestService.bulkApproveByDivision(assessmentId, false, body.getDivisionId(), actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: bulk approve for competition
    // -------------------------------------------------------------------------

    @PutMapping("/competitions/{competitionId}/bulk-approve")
    public ResponseEntity<?> bulkApproveCompetition(
            @PathVariable UUID competitionId,
            @RequestBody BulkApproveRequestDTO body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(
                joinRequestService.bulkApprove(competitionId, true, body.getRequestIds(), actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // TEACHER/ADMIN: bulk approve by division for competition
    // -------------------------------------------------------------------------

    @PutMapping("/competitions/{competitionId}/bulk-approve-by-division")
    public ResponseEntity<?> bulkApproveCompetitionByDivision(
            @PathVariable UUID competitionId,
            @RequestBody BulkApproveByDivisionRequestDTO body,
            @RequestHeader("Authorization") String auth) {

        Claims claims = parseClaims(auth);
        requireRole(claims, "TEACHER", "ADMIN");
        UUID actorId = UUID.fromString(claims.getSubject());
        boolean isAdmin = "ADMIN".equals(claims.get("role", String.class));

        return ResponseEntity.ok(
                joinRequestService.bulkApproveByDivision(competitionId, true, body.getDivisionId(), actorId, isAdmin));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Claims parseClaims(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Missing or invalid Authorization header");
        }
        return jwtService.parseToken(authHeader.substring(7));
    }

    private void requireRole(Claims claims, String... allowedRoles) {
        String role = claims.get("role", String.class);
        for (String allowed : allowedRoles) {
            if (allowed.equals(role)) return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Required role: " + String.join(" or ", allowedRoles));
    }

    private JoinRequestStatus parseStatus(String status) {
        try {
            return JoinRequestStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }
}
