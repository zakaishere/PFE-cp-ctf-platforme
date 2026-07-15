package com.university.platform.assessment.controller;
import com.university.platform.assessment.repository.ExamViolationRepository;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.dto.CheatLogRequestDTO;
import com.university.platform.assessment.model.ExamViolation;
import com.university.platform.assessment.model.OpenTP;
import com.university.platform.audit.AuditDomain;
import com.university.platform.audit.AuditEventService;
import com.university.platform.audit.AuditIpService;
import com.university.platform.audit.Severity;

import com.university.platform.identity.repository.StudentRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class AntiCheatController {

    private final ExamViolationRepository examViolationRepository;
    private final StudentRepository studentRepository;
    private final AssessmentRepository assessmentRepository;
    private final AuditEventService auditEventService;
    private final AuditIpService auditIpService;

    @PostMapping("/cheat-logs")
    @Transactional
    public ResponseEntity<Map<String, String>> logCheatEvent(
            @RequestBody @Valid CheatLogRequestDTO req,
            HttpServletRequest request) {
        var student = studentRepository.findById(req.getStudentId())
                .orElseThrow(() -> new IllegalArgumentException("Student not found"));
        var assessment = assessmentRepository.findById(req.getAssessmentId())
                .orElseThrow(() -> new IllegalArgumentException("Assessment not found"));

        ExamViolation violation = ExamViolation.builder()
                .student(student)
                .assessment(assessment)
                .violationType(req.getViolationType())
                .timestamp(LocalDateTime.now())
                .build();

        examViolationRepository.save(violation);

        AuditDomain domain = assessment instanceof OpenTP ? AuditDomain.TP : AuditDomain.EXAM;
        String ip = AuditIpService.clientIp(request);

        Map<String, Object> detail = new HashMap<>();
        detail.put("violationType", req.getViolationType());
        if (ip != null) detail.put("ip", ip);
        auditEventService.record(
                domain,
                req.getViolationType(),
                assessment.getAssessmentId(),
                null,
                student.getId(),
                null,
                null,
                detail,
                Severity.WARN);

        // Feed the multi-IP tracker (flags automatically on a 2nd distinct IP).
        auditIpService.recordIp(domain, assessment.getAssessmentId(), student.getId(), ip);

        return ResponseEntity.ok(Map.of("message", "Violation logged successfully"));
    }
}
