package com.university.platform.ctf.controller;

import com.university.platform.ctf.repository.CTFChallengeBuildRepository;
import com.university.platform.ctf.service.InternalZipTokenService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Internal endpoints called by the worker agent, not by browser clients.
 * permitAll() at the SecurityConfig layer — the agent has no platform JWT —
 * but /zip/{id} itself requires a short-lived, per-challenge bearer token
 * (InternalZipTokenService) issued only when a build is dispatched. A
 * challenge ZIP is usually the exact flag-check logic; serving it to anyone
 * who can guess/scrape a challenge UUID would be a direct answer leak.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal")
public class CTFInternalController {

    private final CTFChallengeBuildRepository buildRepo;
    private final InternalZipTokenService     zipTokenService;

    public CTFInternalController(CTFChallengeBuildRepository buildRepo,
                                  InternalZipTokenService zipTokenService) {
        this.buildRepo       = buildRepo;
        this.zipTokenService = zipTokenService;
    }

    @GetMapping("/zip/{challengeId}")
    public ResponseEntity<Resource> getZip(@PathVariable UUID challengeId,
                                            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7) : null;
        if (!zipTokenService.verify(challengeId, token)) {
            log.warn("Rejected unauthorized/expired zip download for challenge {}", challengeId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return buildRepo.findTopByChallengeIdOrderByCreatedAtDesc(challengeId)
                .filter(b -> b.getZipFilePath() != null)
                .map(b -> {
                    Path zipPath = Path.of(b.getZipFilePath());
                    if (!Files.exists(zipPath)) {
                        log.warn("ZIP file not found on disk for challenge {}: {}", challengeId, zipPath);
                        return ResponseEntity.<Resource>notFound().<Resource>build();
                    }
                    Resource resource = new FileSystemResource(zipPath);
                    return ResponseEntity.ok()
                            .contentType(MediaType.APPLICATION_OCTET_STREAM)
                            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"challenge.zip\"")
                            .<Resource>body(resource);
                })
                .orElseGet(() -> {
                    log.warn("No build record with ZIP found for challenge {}", challengeId);
                    return ResponseEntity.<Resource>notFound().build();
                });
    }
}
