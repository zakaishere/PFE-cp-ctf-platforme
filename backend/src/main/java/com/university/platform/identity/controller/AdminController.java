package com.university.platform.identity.controller;
import com.university.platform.identity.model.Admin;

import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.model.Teacher.TeacherStatus;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")   
public class AdminController {

    private final TeacherRepository teacherRepository;
    private final EmailService      emailService;

    @GetMapping("/pending-teachers")
    public ResponseEntity<List<Teacher>> getPendingTeachers() {
        List<Teacher> pending = teacherRepository
                .findByStatusAndIsEmailVerifiedTrue(TeacherStatus.PENDING);
        return ResponseEntity.ok(pending);
    }

    @PutMapping("/teachers/{id}/activate")
    @Transactional
    public ResponseEntity<Map<String, String>> activateTeacher(@PathVariable UUID id) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Teacher not found with id: " + id));

        if (teacher.getStatus() == TeacherStatus.ACTIVE) {
            return ResponseEntity.ok(Map.of("message", "Teacher account is already active."));
        }

        if (!teacher.getIsEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot activate a teacher whose email is not yet verified.");
        }

        teacher.setStatus(TeacherStatus.ACTIVE);
        teacherRepository.save(teacher);

        emailService.sendTeacherApprovedEmail(teacher.getEmail(), teacher.getFirstName());
        log.info("[ADMIN] Teacher activated: {}", teacher.getEmail());

        return ResponseEntity.ok(Map.of("message",
                "Teacher " + teacher.getFirstName() + " " + teacher.getLastName()
                + " has been activated. Approval email sent."));
    }

    @DeleteMapping("/teachers/{id}/reject")
    @Transactional
    public ResponseEntity<Map<String, String>> rejectTeacher(@PathVariable UUID id) {
        Teacher teacher = teacherRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Teacher not found with id: " + id));

        if (teacher.getStatus() == TeacherStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reject an already active teacher.");
        }

        teacherRepository.delete(teacher);
        log.info("[ADMIN] Teacher rejected and deleted: {}", teacher.getEmail());

        return ResponseEntity.ok(Map.of("message", "Teacher application has been rejected."));
    }
}
