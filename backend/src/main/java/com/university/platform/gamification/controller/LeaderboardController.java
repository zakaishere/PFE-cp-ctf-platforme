package com.university.platform.gamification.controller;

import com.university.platform.identity.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final StudentRepository studentRepository;

    @GetMapping
    public List<Map<String, Object>> getLeaderboard() {
        return studentRepository.findTop10ByOrderByTotalPointsDesc().stream()
                .map(student -> Map.<String, Object>of(
                        "studentId", student.getId(),
                        "firstName", student.getFirstName(),
                        "lastName", student.getLastName(),
                        "totalPoints", student.getTotalPoints() != null ? student.getTotalPoints() : 0
                ))
                .collect(Collectors.toList());
    }
}
