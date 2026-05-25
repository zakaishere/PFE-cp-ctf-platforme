package com.university.platform.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Caffeine-backed cache manager with per-cache TTLs.
 *
 * <p>The caches are wired and ready, but no service is annotated with
 * {@code @Cacheable}/{@code @CacheEvict} yet — those annotations live on read
 * methods in the service layer and must be added there to take effect.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();

        // Different TTLs per cache
        Map<String, Caffeine<Object, Object>> caches = Map.of(

            // Scoreboard: recompute every 30 seconds
            "scoreboard", Caffeine.newBuilder()
                .maximumSize(100)
                .expireAfterWrite(30, TimeUnit.SECONDS),

            // Challenge list: 60 seconds
            "challenges", Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(60, TimeUnit.SECONDS),

            // Competition status: 10 seconds (near real-time)
            "competition-status", Caffeine.newBuilder()
                .maximumSize(100)
                .expireAfterWrite(10, TimeUnit.SECONDS),

            // User profile: 5 minutes (rarely changes)
            "user-profile", Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(5, TimeUnit.MINUTES),

            // Leaderboard: 2 minutes
            "leaderboard", Caffeine.newBuilder()
                .maximumSize(50)
                .expireAfterWrite(2, TimeUnit.MINUTES)
        );

        // Apply custom specs
        caches.forEach((name, caffeine) ->
            manager.registerCustomCache(name, caffeine.recordStats().build()));

        // Default for anything not listed above
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(200)
            .expireAfterWrite(60, TimeUnit.SECONDS));

        return manager;
    }
}
