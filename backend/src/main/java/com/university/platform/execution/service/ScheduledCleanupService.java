package com.university.platform.execution.service;

import com.university.platform.execution.service.DockerService.TestCaseResult;
import com.university.platform.assessment.repository.AssessmentRepository;
import com.university.platform.assessment.model.OpenTP;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledCleanupService {

    private final AssessmentRepository assessmentRepository;

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupAbandonedContainersAndAssessments() {
        log.info("[CRON] Starting nightly cleanup job...");
        
        File tempDir = new File("/tmp"); 
        if (tempDir.exists() && tempDir.isDirectory()) {
            File[] files = tempDir.listFiles((dir, name) -> name.startsWith("docker-worker-"));
            if (files != null) {
                for (File file : files) {
                    if (file.lastModified() < System.currentTimeMillis() - 24 * 60 * 60 * 1000) {
                        try {
                            deleteDirectory(file.toPath());
                            log.info("[CRON] Deleted abandoned temp folder: {}", file.getName());
                        } catch (Exception e) {
                            log.warn("[CRON] Failed to delete temp folder: {}", file.getName());
                        }
                    }
                }
            }
        }

        long closedCount = assessmentRepository.findAll().stream()
                .filter(a -> a instanceof OpenTP)
                .map(a -> (OpenTP) a)
                .filter(tp -> tp.getIsPublished() && tp.getDeadline().isBefore(LocalDateTime.now()))
                .peek(tp -> {
                    tp.setIsPublished(false);
                    assessmentRepository.save(tp);
                })
                .count();

        log.info("[CRON] Closed {} expired OpenTP assessments.", closedCount);
        log.info("[CRON] Nightly cleanup job finished.");
    }

    private void deleteDirectory(Path path) throws Exception {
        if (Files.isDirectory(path)) {
            try (var stream = Files.list(path)) {
                for (Path p : stream.toList()) {
                    deleteDirectory(p);
                }
            }
        }
        Files.delete(path);
    }
}
