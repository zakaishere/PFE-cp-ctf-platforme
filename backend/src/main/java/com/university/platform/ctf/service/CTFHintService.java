package com.university.platform.ctf.service;

import com.university.platform.ctf.dto.CTFHint;
import com.university.platform.ctf.entity.CTFAward;
import com.university.platform.ctf.entity.CTFChallenge;
import com.university.platform.ctf.entity.CTFHintUnlock;
import com.university.platform.ctf.repository.CTFAwardRepository;
import com.university.platform.ctf.repository.CTFChallengeRepository;
import com.university.platform.ctf.repository.CTFHintUnlockRepository;
import com.university.platform.identity.model.Student;
import com.university.platform.identity.repository.StudentRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CTFHintService {

    private final CTFChallengeRepository  challengeRepository;
    private final CTFHintUnlockRepository hintUnlockRepository;
    private final StudentRepository       studentRepository;
    private final CTFAwardRepository      awardRepository;

    /**
     * Unlock a hint.
     *
     * Competition mode (competitionId + teamId non-null): inserts a negative
     *   CTFAward so the team's scoreboard total is reduced by hint.cost().
     *   Does NOT touch student.totalPoints.
     *
     * Practice mode (competitionId == null): deducts from student.totalPoints.
     *
     * Re-unlock: returns the hint text directly instead of throwing 409.
     *
     * @param competitionId null for practice mode
     * @param teamId        null for practice mode
     */
    @Transactional
    public CTFHint unlockHint(UUID challengeId, String hintId, UUID userId,
                               UUID teamId, UUID competitionId) {

        CTFChallenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        CTFHint hint = challenge.getHints().stream()
                .filter(h -> h.id().equals(hintId))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Hint not found: " + hintId));

        // Already unlocked — return hint text (student already paid; no double-charge).
        if (hintUnlockRepository.existsByChallengeIdAndUserIdAndHintId(challengeId, userId, hintId)) {
            return hint;
        }

        if (competitionId != null && teamId != null) {
            // Competition mode: deduct from team score via ctf_awards.
            awardRepository.save(CTFAward.builder()
                    .competitionId(competitionId)
                    .teamId(teamId)
                    .value(-hint.cost())
                    .reason("hint:" + hintId)
                    .build());
        } else {
            // Practice mode: deduct from student.totalPoints.
            Student student = studentRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Student not found."));
            if (student.getTotalPoints() < hint.cost()) {
                throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                        "Not enough points. You need " + hint.cost() + " points.");
            }
            student.setTotalPoints(student.getTotalPoints() - hint.cost());
            studentRepository.save(student);
        }

        hintUnlockRepository.save(CTFHintUnlock.builder()
                .challengeId(challengeId)
                .userId(userId)
                .hintId(hintId)
                .pointsSpent(hint.cost())
                .build());

        return hint;
    }
}
