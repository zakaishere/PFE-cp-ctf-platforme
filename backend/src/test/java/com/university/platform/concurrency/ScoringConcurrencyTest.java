package com.university.platform.concurrency;

import com.university.platform.competition.model.CompetitionAttemptStats;
import com.university.platform.competition.repository.CompetitionAttemptStatsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the concurrency fixes against a real Postgres (the prod engine).
 *
 * {@link CompetitionAttemptStats} has no FK relations (plain UUID columns), so
 * we can exercise the exact lock/upsert hot path that teammates sharing one
 * participant row hit — without seeding the whole competition graph.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "spring.rabbitmq.listener.simple.auto-startup=false",
                "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration"
        })
@Testcontainers
class ScoringConcurrencyTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired CompetitionAttemptStatsRepository statsRepo;
    @Autowired PlatformTransactionManager txManager;

    /**
     * 50 teammates submit wrong answers concurrently against the SAME
     * participant/problem row. Each does the read-modify-write the scorer does,
     * but through the pessimistic lock. Without the lock, READ_COMMITTED loses
     * updates and the count comes out < 50. With it, it must be exactly 50.
     */
    @Test
    void concurrentTeammateWrongAttempts_noLostUpdates() throws Exception {
        UUID competitionId = UUID.randomUUID();
        UUID problemId     = UUID.randomUUID();
        UUID teamId        = UUID.randomUUID();   // shared participant row

        int threads = 50;
        ExecutorService pool = Executors.newFixedThreadPool(16);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done  = new CountDownLatch(threads);
        TransactionTemplate tx = new TransactionTemplate(txManager);

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                    tx.executeWithoutResult(s -> {
                        statsRepo.insertIfAbsent(competitionId, problemId, teamId, true);
                        CompetitionAttemptStats stats = statsRepo
                                .findForUpdate(competitionId, problemId, teamId)
                                .orElseThrow();
                        stats.setWrongAttempts(stats.getWrongAttempts() + 1);
                        statsRepo.save(stats);
                    });
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertThat(done.await(60, TimeUnit.SECONDS)).isTrue();
        pool.shutdown();

        CompetitionAttemptStats finalRow = statsRepo
                .findByCompetitionIdAndProblemIdAndParticipantId(competitionId, problemId, teamId)
                .orElseThrow();
        assertThat(finalRow.getWrongAttempts())
                .as("every concurrent increment must be counted (no lost updates)")
                .isEqualTo(threads);
    }

    /**
     * Concurrent first-creation of the same participant row must produce exactly
     * one row (the ON CONFLICT DO NOTHING upsert), never a duplicate-key crash.
     */
    @Test
    void concurrentInsertIfAbsent_createsExactlyOneRow() throws Exception {
        UUID competitionId = UUID.randomUUID();
        UUID problemId     = UUID.randomUUID();
        UUID participant   = UUID.randomUUID();

        int threads = 30;
        ExecutorService pool = Executors.newFixedThreadPool(16);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done  = new CountDownLatch(threads);
        AtomicInteger failures = new AtomicInteger();
        TransactionTemplate tx = new TransactionTemplate(txManager);

        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                    tx.executeWithoutResult(s ->
                            statsRepo.insertIfAbsent(competitionId, problemId, participant, false));
                } catch (Exception e) {
                    failures.incrementAndGet();
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertThat(done.await(60, TimeUnit.SECONDS)).isTrue();
        pool.shutdown();

        assertThat(failures.get()).as("upsert must never throw").isZero();
        assertThat(statsRepo.findByCompetitionId(competitionId)).hasSize(1);
    }
}
