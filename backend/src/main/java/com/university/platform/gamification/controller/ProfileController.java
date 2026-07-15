package com.university.platform.gamification.controller;

import com.university.platform.gamification.dto.UpdateProfileRequest;
import com.university.platform.gamification.dto.UserProfileDTO;
import com.university.platform.gamification.service.ProfileService;
import com.university.platform.identity.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final JwtService jwtService;

    /** Own profile — resolved from the JWT. Includes private fields (email). */
    @GetMapping("/me")
    public ResponseEntity<UserProfileDTO> getMyProfile(
            @RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(profileService.getProfile(callerId(authHeader), true));
    }

    /** Update own username / bio / avatar. Only non-null fields are applied. */
    @PatchMapping("/me")
    public ResponseEntity<UserProfileDTO> updateMyProfile(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateProfile(callerId(authHeader), request));
    }

    /** Public profile by username (pretty URL). Email is hidden. */
    @GetMapping("/u/{username}")
    public ResponseEntity<UserProfileDTO> getByUsername(@PathVariable String username) {
        return ResponseEntity.ok(profileService.getByUsername(username));
    }

    /** Public profile by user id. Email is hidden. */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileDTO> getPublicProfile(@PathVariable UUID userId) {
        return ResponseEntity.ok(profileService.getProfile(userId, false));
    }

    private UUID callerId(String authHeader) {
        return UUID.fromString(jwtService.parseToken(authHeader.substring(7)).getSubject());
    }
}
