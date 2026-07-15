package com.university.platform.gamification.controller;

import com.university.platform.gamification.dto.LeaderboardEntryDTO;
import com.university.platform.gamification.service.LeaderboardRankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Triple leaderboard endpoints (Global / CP / CTF).
 * The legacy GET /api/leaderboard (top-10 by total_points) lives in
 * LeaderboardController and is intentionally left untouched.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardRankingController {

    private final LeaderboardRankingService rankingService;

    @GetMapping("/global")
    public ResponseEntity<List<LeaderboardEntryDTO>> getGlobal(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(rankingService.getGlobalRanking(limit));
    }

    @GetMapping("/cp")
    public ResponseEntity<List<LeaderboardEntryDTO>> getCp(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(rankingService.getCpRanking(limit));
    }

    @GetMapping("/ctf")
    public ResponseEntity<List<LeaderboardEntryDTO>> getCtf(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(rankingService.getCtfRanking(limit));
    }
}
