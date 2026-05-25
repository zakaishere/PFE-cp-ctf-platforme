package com.university.platform.ctf.controller;

import com.university.platform.ctf.dto.CTFBuildResponse;
import com.university.platform.ctf.entity.CTFChallenge;
import com.university.platform.ctf.entity.CTFChallengeBuild;
import com.university.platform.ctf.repository.CTFChallengeBuildRepository;
import com.university.platform.ctf.repository.CTFChallengeRepository;
import com.university.platform.ctf.service.CTFBuildService;
import com.university.platform.ctf.service.CTFStorageService;
import com.university.platform.identity.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/teacher/ctf/challenges")
@RequiredArgsConstructor
public class CTFChallengeUploadController {

    private static final Pattern REGISTRY_URL_PATTERN =
            Pattern.compile("^[a-zA-Z0-9._\\-/:@]+$");

    private final CTFChallengeRepository      challengeRepo;
    private final CTFChallengeBuildRepository buildRepo;
    private final CTFBuildService             buildService;
    private final CTFStorageService           storageService;
    private final JwtService                  jwtService;

    @Value("${ctf.build.max-zip-size-mb:100}")
    private int maxZipSizeMb;

    // ── Upload ZIP ────────────────────────────────────────────────────────────

    @PostMapping(value = "/{challengeId}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CTFBuildResponse> uploadZip(
            @PathVariable UUID challengeId,
            @RequestParam("file") MultipartFile file,
            @RequestHeader("Authorization") String authHeader) {

        Claims claims = requireTeacher(authHeader);
        UUID   userId = UUID.fromString(claims.getSubject());
        String role   = claims.get("role", String.class);

        // Validate file
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required.");
        }
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.toLowerCase().endsWith(".zip")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .zip files are accepted.");
        }
        long maxBytes = (long) maxZipSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "File exceeds maximum size of " + maxZipSizeMb + " MB.");
        }

        // Verify challenge ownership
        CTFChallenge challenge = loadChallenge(challengeId);
        verifyOwnership(challenge, userId, role);

        // Check for in-progress build
        Optional<CTFChallengeBuild> latest = buildRepo.findTopByChallengeIdOrderByCreatedAtDesc(challengeId);
        if (latest.isPresent()) {
            String status = latest.get().getBuildStatus();
            if ("BUILDING".equals(status) || "PULLING".equals(status)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Build already in progress.");
            }
        }

        try {
            // Save ZIP and compute SHA-256 BEFORE starting async build
            Path zipPath = storageService.saveZip(file, challengeId);
            String sha256 = storageService.sha256(zipPath);

            if (latest.isPresent() && "READY".equals(latest.get().getBuildStatus())) {
                // Rebuild: increment version
                CTFChallengeBuild existing = latest.get();
                existing.setZipFilePath(zipPath.toString());
                existing.setZipOriginalName(originalName);
                existing.setZipSha256(sha256);
                existing.setSourceType("ZIP");
                existing.setBuiltBy(userId);
                buildRepo.save(existing);

                buildService.rebuild(existing, zipPath);

                return ResponseEntity.ok(CTFBuildResponse.builder()
                        .buildId(existing.getId())
                        .status("BUILDING")
                        .message("Rebuilding Docker image from uploaded ZIP (version " + (existing.getVersion() + 1) + ").")
                        .build());
            } else {
                // New build
                CTFChallengeBuild build = CTFChallengeBuild.builder()
                        .challengeId(challengeId)
                        .sourceType("ZIP")
                        .zipFilePath(zipPath.toString())
                        .zipOriginalName(originalName)
                        .zipSha256(sha256)
                        .buildStatus("PENDING")
                        .builtBy(userId)
                        .version(1)
                        .build();
                buildRepo.save(build);

                buildService.buildFromZip(build, zipPath);

                return ResponseEntity.status(HttpStatus.ACCEPTED).body(CTFBuildResponse.builder()
                        .buildId(build.getId())
                        .status("BUILDING")
                        .message("Docker image build started from uploaded ZIP.")
                        .build());
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to process ZIP upload for challenge {}: {}", challengeId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to process upload: " + e.getMessage());
        }
    }

    // ── Set registry image ────────────────────────────────────────────────────

    @PostMapping("/{challengeId}/registry")
    public ResponseEntity<CTFBuildResponse> setRegistry(
            @PathVariable UUID challengeId,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {

        Claims claims = requireTeacher(authHeader);
        UUID   userId = UUID.fromString(claims.getSubject());
        String role   = claims.get("role", String.class);

        String registryUrl = body.getOrDefault("registryUrl", "").trim();
        if (registryUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "registryUrl is required.");
        }
        if (!REGISTRY_URL_PATTERN.matcher(registryUrl).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid registry URL format.");
        }

        CTFChallenge challenge = loadChallenge(challengeId);
        verifyOwnership(challenge, userId, role);

        Optional<CTFChallengeBuild> latest = buildRepo.findTopByChallengeIdOrderByCreatedAtDesc(challengeId);
        if (latest.isPresent()) {
            String status = latest.get().getBuildStatus();
            if ("BUILDING".equals(status) || "PULLING".equals(status)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Build already in progress.");
            }
        }

        CTFChallengeBuild build = CTFChallengeBuild.builder()
                .challengeId(challengeId)
                .sourceType("REGISTRY")
                .registryUrl(registryUrl)
                .buildStatus("PENDING")
                .builtBy(userId)
                .version(1)
                .build();
        buildRepo.save(build);

        buildService.pullFromRegistry(build, registryUrl);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(CTFBuildResponse.builder()
                .buildId(build.getId())
                .status("PULLING")
                .message("Pulling Docker image from registry: " + registryUrl)
                .build());
    }

    // ── Build status ──────────────────────────────────────────────────────────

    @GetMapping("/{challengeId}/build-status")
    public ResponseEntity<CTFChallengeBuild> getBuildStatus(
            @PathVariable UUID challengeId,
            @RequestHeader("Authorization") String authHeader) {

        Claims claims = requireTeacher(authHeader);
        UUID   userId = UUID.fromString(claims.getSubject());
        String role   = claims.get("role", String.class);
        CTFChallenge challenge = loadChallenge(challengeId);
        verifyOwnership(challenge, userId, role);

        CTFChallengeBuild build = buildRepo.findTopByChallengeIdOrderByCreatedAtDesc(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No build found for this challenge."));

        // Clear sensitive path from response
        build.setZipFilePath(null);
        return ResponseEntity.ok(build);
    }

    // ── Build log ─────────────────────────────────────────────────────────────

    @GetMapping(value = "/{challengeId}/build-log", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getBuildLog(
            @PathVariable UUID challengeId,
            @RequestHeader("Authorization") String authHeader) {

        Claims claims = requireTeacher(authHeader);
        UUID   userId = UUID.fromString(claims.getSubject());
        String role   = claims.get("role", String.class);
        CTFChallenge challenge = loadChallenge(challengeId);
        verifyOwnership(challenge, userId, role);

        CTFChallengeBuild build = buildRepo.findTopByChallengeIdOrderByCreatedAtDesc(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No build found for this challenge."));

        String log = build.getBuildLog();
        return ResponseEntity.ok(log != null ? log : "(no log available)");
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Validates the JWT, asserts TEACHER or ADMIN role, and returns the userId + role.
     */
    private Claims requireTeacher(String authHeader) {
        Claims claims = jwtService.parseToken(authHeader.substring(7));
        String role = claims.get("role", String.class);
        if (!"TEACHER".equals(role) && !"ADMIN".equals(role)) {
            throw new AccessDeniedException("Teacher or Admin role required.");
        }
        return claims;
    }

    private CTFChallenge loadChallenge(UUID challengeId) {
        return challengeRepo.findByIdAndDeletedFalse(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
    }

    /**
     * Verifies the calling user owns this challenge or is an ADMIN.
     */
    private void verifyOwnership(CTFChallenge challenge, UUID userId, String role) {
        if ("ADMIN".equals(role)) return;
        if (!challenge.getAuthorId().equals(userId)) {
            throw new AccessDeniedException("You do not own this challenge.");
        }
    }
}
