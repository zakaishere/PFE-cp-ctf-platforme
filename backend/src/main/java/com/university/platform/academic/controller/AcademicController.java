package com.university.platform.academic.controller;

import com.university.platform.academic.repository.DivisionRepository;
import com.university.platform.academic.repository.ModuleRepository;
import com.university.platform.academic.repository.SemesterRepository;
import com.university.platform.identity.repository.DepartmentRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/academic")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AcademicController {

    private final DivisionRepository   divisionRepository;
    private final SemesterRepository   semesterRepository;
    private final DepartmentRepository departmentRepository;
    private final ModuleRepository     moduleRepository;

    @GetMapping("/departments")
    public ResponseEntity<List<Map<String, Object>>> getDepartments() {
        List<Map<String, Object>> result = departmentRepository.findAll().stream()
                .map(d -> Map.<String, Object>of(
                        "id",   d.getDeptId().toString(),
                        "name", d.getName()
                ))
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/departments/{deptId}/divisions")
    public ResponseEntity<List<Map<String, Object>>> getDivisionsByDepartment(
            @PathVariable UUID deptId) {
        List<Map<String, Object>> result = divisionRepository.findByDepartment_DeptId(deptId).stream()
                .map(d -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id",   d.getDivisionId().toString());
                    map.put("name", d.getName());
                    map.put("type", d.getType());
                    return map;
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    @Transactional
    @GetMapping("/divisions")
    public ResponseEntity<List<Map<String, Object>>> getDivisions() {
        List<Map<String, Object>> result = divisionRepository.findAll().stream()
                .map(d -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id",   d.getDivisionId().toString());
                    map.put("name", d.getName());
                    map.put("type", d.getType());
                    if (d.getDepartment() != null) {
                        map.put("departmentId",   d.getDepartment().getDeptId().toString());
                        map.put("departmentName", d.getDepartment().getName());
                    }
                    return map;
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/semesters")
    public ResponseEntity<List<Map<String, Object>>> getSemesters() {
        List<Map<String, Object>> result = semesterRepository.findAll().stream()
                .map(s -> Map.<String, Object>of(
                        "id",   s.getSemesterId().toString(),
                        "name", s.getName()
                ))
                .toList();
        return ResponseEntity.ok(result);
    }

    @Transactional
    @GetMapping("/modules")
    public ResponseEntity<List<Map<String, Object>>> getModules(
            @RequestParam(required = false) UUID divisionId,
            @RequestParam(required = false) UUID semesterId) {

        var modules = (divisionId != null && semesterId != null)
                ? moduleRepository.findByDivision_DivisionIdAndSemester_SemesterId(divisionId, semesterId)
                : (divisionId != null)
                        ? moduleRepository.findByDivision_DivisionId(divisionId)
                        : moduleRepository.findAll();

        List<Map<String, Object>> result = modules.stream()
                .map(m -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id",   m.getModuleId().toString());
                    map.put("name", m.getName());
                    if (m.getDivision() != null)  map.put("divisionName",  m.getDivision().getName());
                    if (m.getSemester() != null)  map.put("semesterName",  m.getSemester().getName());
                    return map;
                })
                .toList();
        return ResponseEntity.ok(result);
    }
}
