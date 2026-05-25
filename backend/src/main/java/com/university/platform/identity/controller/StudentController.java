package com.university.platform.identity.controller;

import com.university.platform.academic.model.Division;
import com.university.platform.academic.model.Module;
import com.university.platform.academic.model.Semester;
import com.university.platform.academic.repository.DivisionRepository;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.academic.repository.SemesterRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.repository.StudentRepository;
import com.university.platform.identity.service.JwtService;
import com.university.platform.execution.service.ScoringService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StudentController {

    private final StudentRepository studentRepository;
    private final DivisionRepository divisionRepository;
    private final SemesterRepository semesterRepository;
    private final JwtService jwtService;
    private final ScoringService scoringService;

    @Transactional
    @GetMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> getProfile(
            @RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        UUID userId = jwtService.extractUserId(token);
        Student student = studentRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        Map<String, Object> profile = new java.util.HashMap<>();
        profile.put("userId", student.getId().toString());
        profile.put("firstName", student.getFirstName());
        profile.put("lastName", student.getLastName());
        profile.put("email", student.getEmail());
        profile.put("apogeeNumber", student.getApogeeNumber());
        profile.put("totalPoints", student.getTotalPoints());
        profile.put("profileComplete", student.getDivision() != null && student.getSemester() != null);

        if (student.getDivision() != null) {
            profile.put("divisionId", student.getDivision().getDivisionId().toString());
            profile.put("divisionName", student.getDivision().getName());
        }
        if (student.getSemester() != null) {
            profile.put("semesterId", student.getSemester().getSemesterId().toString());
            profile.put("semesterName", student.getSemester().getName());
        }
        if (student.getCohort() != null) {
            profile.put("cohortId", student.getCohort().getCohortId().toString());
            profile.put("cohortLabel", student.getCohort().getYear() + " - " + student.getCohort().getSemester());
        }
        return ResponseEntity.ok(profile);
    }

    @Transactional
    @PatchMapping("/me/profile")
    public ResponseEntity<Map<String, String>> updateProfile(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {

        String token = authHeader.replace("Bearer ", "");
        UUID userId = jwtService.extractUserId(token);

        Student student = studentRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        Division resolvedDivision = null;

        if (body.containsKey("divisionId") && body.get("divisionId") != null) {
            resolvedDivision = divisionRepository.findById(UUID.fromString(body.get("divisionId")))
                    .orElseThrow(() -> new RuntimeException("Division not found"));
            student.setDivision(resolvedDivision);
        }

        if (body.containsKey("departmentId") && body.get("departmentId") != null) {
            UUID requestedDeptId = UUID.fromString(body.get("departmentId"));
            Division division = resolvedDivision != null ? resolvedDivision : student.getDivision();
            if (division == null || division.getDepartment() == null) {
                throw new RuntimeException("Cannot validate department: no division is set");
            }
            if (!division.getDepartment().getDeptId().equals(requestedDeptId)) {
                throw new RuntimeException("Validation failed: the selected division does not belong to the specified department");
            }
        }

        if (body.containsKey("semesterId") && body.get("semesterId") != null) {
            Semester semester = semesterRepository.findById(UUID.fromString(body.get("semesterId")))
                    .orElseThrow(() -> new RuntimeException("Semester not found"));
            student.setSemester(semester);
        }

        studentRepository.save(student);
        return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
    }

    @GetMapping("/me/exams/{examId}/results")
    public ResponseEntity<?> getExamResults(
            @PathVariable UUID examId,
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        UUID studentId = jwtService.extractUserId(token);

        if (!studentRepository.existsById(studentId)) {
            return ResponseEntity.status(403).build();
        }

        double finalGrade = scoringService.calculateFinalExamGrade(studentId, examId);

        return ResponseEntity.ok(Map.of(
            "examId", examId.toString(),
            "finalGrade", finalGrade
        ));
    }
}
