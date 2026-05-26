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
        // 60 requests per minute with a burst of 20
        Bandwidth limit = Bandwidth.classic(60, Refill.greedy(60, Duration.ofMinutes(1)));
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
}
