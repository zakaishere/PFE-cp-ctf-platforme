package com.university.platform.ctf.repository;

import com.university.platform.ctf.entity.CTFHintUnlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CTFHintUnlockRepository extends JpaRepository<CTFHintUnlock, UUID> {

    boolean existsByChallengeIdAndUserIdAndHintId(UUID challengeId, UUID userId, String hintId);

    List<CTFHintUnlock> findByChallengeIdAndUserId(UUID challengeId, UUID userId);

    /** Whether any student has unlocked the given hint id on this challenge. */
    boolean existsByChallengeIdAndHintId(UUID challengeId, String hintId);
}
