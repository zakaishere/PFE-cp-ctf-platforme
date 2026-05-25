package com.university.platform.identity.controller;

import com.university.platform.academic.model.Module;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.identity.dto.UpdateTeacherModulesRequest;
import com.university.platform.identity.model.Teacher;
import com.university.platform.identity.repository.TeacherRepository;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/teachers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TeacherController {

    private final TeacherRepository teacherRepository;
    private final ModuleRepository  moduleRepository;
    private final JwtService        jwtService;

    @PutMapping("/me/modules")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMyModules(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateTeacherModulesRequest req) {

        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        if (req.getModuleIds() == null || req.getModuleIds().isEmpty()) {
            teacher.getModules().clear();
            teacherRepository.save(teacher);
            return ResponseEntity.ok(Map.of("message", "All module assignments cleared", "assignedCount", 0));
        }

        List<Module> modules = new ArrayList<>();
        for (UUID moduleId : req.getModuleIds()) {
            Module m = moduleRepository.findById(moduleId)
                    .orElseThrow(() -> new RuntimeException("Module not found: " + moduleId));
            modules.add(m);
        }

        teacher.getModules().clear();
        teacher.getModules().addAll(modules);
        teacherRepository.save(teacher);

        return ResponseEntity.ok(Map.of(
                "message", "Module assignments updated successfully",
                "assignedCount", modules.size()
        ));
    }

    @GetMapping("/me/modules")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMyModules(
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        UUID teacherId = jwtService.extractUserId(token);

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        List<Map<String, Object>> modules = teacher.getModules().stream()
                .map(m -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("moduleId", m.getModuleId());
                    map.put("name", m.getName());
                    if (m.getDivision() != null) map.put("divisionName", m.getDivision().getName());
                    if (m.getSemester() != null) map.put("semesterName", m.getSemester().getName());
                    return map;
                }).toList();

        return ResponseEntity.ok(modules);
    }
}
