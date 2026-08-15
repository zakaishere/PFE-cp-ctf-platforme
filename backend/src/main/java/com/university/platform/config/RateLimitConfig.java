package com.university.platform.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class RateLimitConfig {

    // Per-IP bucket store — in-memory, resets on restart.
    // Good enough for a university platform; replace with Redis-backed
    // ProxyManager for multi-instance deployments.
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public Bucket resolveBucket(String key) {
        return buckets.computeIfAbsent(key, k -> newBucket());
    }

    private Bucket newBucket() {
        // 240 requests per minute per IP. This bucket is shared by every
        // non-strict endpoint behind one IP, including all read/poll traffic
        // (status, notifications, teams/mine, challenge lists...). A live
        // competition page mounts several polling hooks at once and campus
        // WiFi puts many students behind one NAT IP, so 60/min was tripping
        // on ordinary use, not abuse — 240/min keeps real flooding capped
        // while giving normal polling headroom.
        Bandwidth limit = Bandwidth.classic(240, Refill.greedy(240, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    public Bucket resolveStrictBucket(String key) {
        return buckets.computeIfAbsent("strict:" + key, k -> newStrictBucket());
    }

    private Bucket newStrictBucket() {
        // 10 requests per minute for sensitive endpoints (flag submission, auth)
        Bandwidth limit = Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * Per-(user, event) judge-submission flood control. Keyed by
     * "{studentId}:{eventId}" so a student gets an independent quota per
     * competition / exam / TP / practice problem. Enforced at intake
     * (SubmissionService) — never on the judge worker.
     * 20 submissions/minute — generous for legitimate use, caps floods.
     */
    public Bucket resolveSubmissionBucket(String key) {
        return buckets.computeIfAbsent("submit:" + key, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(20, Refill.greedy(20, Duration.ofMinutes(1))))
                .build());
    }
}
