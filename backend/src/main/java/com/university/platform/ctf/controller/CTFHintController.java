package com.university.platform.ctf.controller;

import com.university.platform.ctf.dto.CTFHint;
import com.university.platform.ctf.service.CTFHintService;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ctf/challenges/{challengeId}/hints")
@RequiredArgsConstructor
public class CTFHintController {

    private final CTFHintService hintService;
    private final JwtService jwtService;

    @PostMapping("/{hintId}/unlock")
    public ResponseEntity<CTFHint> unlockHint(
            @PathVariable UUID challengeId,
            @PathVariable String hintId,
            @RequestParam(required = false) UUID competitionId,
            @RequestParam(required = false) UUID teamId,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = UUID.fromString(jwtService.parseToken(authHeader.substring(7)).getSubject());
        return ResponseEntity.ok(hintService.unlockHint(challengeId, hintId, userId, teamId, competitionId));
    }
}
