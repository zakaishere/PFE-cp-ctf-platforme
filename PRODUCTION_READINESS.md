# Production Readiness Checklist

## Database

- [x] `ddl-auto: validate` — schema changes require manual migration before restart
- [x] All migration files applied up to v19 (`migration_v19_production_indexes.sql`)
- [x] Critical composite indexes added:
  - `ctf_challenges(competition_id)` — challenge list queries
  - `ctf_competition_solves(competition_id, solved_at)` — time-ordered solve history
  - `ctf_hint_unlocks(team_id, challenge_id)` — hint batch lookups
  - `ctf_team_members(user_id)` — membership lookups
  - `ctf_teams(competition_id)` — scoreboard team queries
  - `ctf_competitions(created_by)` WHERE active — teacher dashboard
  - `ctf_submissions(team_id, submitted_at)` — rate-limit window queries
- [x] Duplicate index removed: `idx_ctf_flags_challenge_id` (duplicate of `idx_ctf_flags_challenge`)
- [ ] Regular vacuums/analyzes scheduled (consider `pg_cron` or a cron job)
- [ ] Database backups configured (pg_dump or WAL archiving)

## Connection Pool

- [x] HikariCP `maximum-pool-size` raised from 20 → 50 (dev default)
- [x] `application-prod.yml` created with pool size 80 for production
- [x] `minimum-idle` raised to 10 (reduces connection acquisition spikes)

## Caching

- [x] Caffeine cache infrastructure configured with per-cache TTLs
- [x] `@Cacheable` on `CTFCompetitionService.getScoreboard()` — 30s TTL
- [x] `@Cacheable` on `CTFCompetitionService.getCompetitionChallenges()` — 60s TTL
- [x] `@CacheEvict` on `CTFCompetitionService.submitFlag()` — evicts scoreboard + challenges on solve

## Thread Pools

- [x] `ctfInstanceExecutor`: queue 20 → 50, `AbortPolicy` → `CallerRunsPolicy`
- [x] `ctfBuildExecutor`: queue 10 → 20, max 3 → 5, added `CallerRunsPolicy`

## Rate Limiting

- [x] Bucket4j dependency added (`bucket4j-core 8.10.1`)
- [x] `RateLimitConfig.java`: 60 req/min general, 10 req/min strict (submit/auth)
- [x] `RateLimitInterceptor.java`: per-IP token bucket on all `/api/**` routes
- [x] `WebMvcConfig.java`: interceptor registered, actuator excluded
- [ ] Replace in-memory bucket store with Redis-backed `ProxyManager` for multi-instance

## Monitoring

- [x] `spring-boot-starter-actuator` added to `pom.xml`
- [x] `micrometer-registry-prometheus` added to `pom.xml`
- [x] Actuator endpoints exposed: `health`, `info`, `metrics`, `prometheus` at `/api/actuator`
- [x] Custom metrics: `ctf.flag.submit{result=correct|wrong|rate_limited}` counter
- [ ] Set up Prometheus to scrape `/api/actuator/prometheus`
- [ ] Set up Grafana dashboards for JVM, DB pool, flag submission rate
- [ ] Alert on `ctf.flag.submit{result=rate_limited}` spike

## Infrastructure

- [x] `docker-compose.yml` created with resource limits:
  - postgres: 1 CPU / 512 MB
  - redis: 0.5 CPU / 192 MB
  - backend: 2 CPU / 1 GB
- [x] Health checks configured for all services
- [ ] Add `Dockerfile` to `backend/` before running `docker compose up`
- [ ] Set `JWT_SECRET`, `CTF_FLAG_SECRET`, `DB_PASSWORD` as env vars (not defaults)

## Security

- [x] `disable-verification: false` in `application-prod.yml` (email verification enforced)
- [x] JWT secret loaded from env var (`${JWT_SECRET}`)
- [ ] Enable HTTPS / TLS termination (nginx reverse proxy recommended)
- [ ] Rotate JWT secret before go-live
- [ ] Review CORS origins in `SecurityConfig.java`

## Known Remaining Issues

| Issue | Impact | Fix |
|---|---|---|
| N+1 in `buildScoreboard()`: `memberRepo.countByIdTeamId()` per team | Medium — ~1 extra query per team on scoreboard load | Replace with `JOIN` count query |
| N+1 in `buildChallengeDTO()`: `solveRepo.countByCompetitionIdAndChallengeId()` per challenge | Medium — queries proportional to challenge count | Batch with `GROUP BY challenge_id` |
| `USED_PORTS` is JVM-local (`ConcurrentHashMap`) | Low for single instance — port conflicts if scaled | Move to Redis `SADD`/`SREM` |
| Rate-limit buckets are in-memory | Low for single instance — resets on restart | Move to Bucket4j + Redis `ProxyManager` |
