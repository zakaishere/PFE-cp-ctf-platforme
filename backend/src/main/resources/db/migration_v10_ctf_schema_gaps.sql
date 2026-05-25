-- =============================================================================
--  migration_v10_ctf_schema_gaps.sql
--  Documents and fills schema gaps that Hibernate ddl-auto:update was
--  silently creating. All statements are idempotent (IF NOT EXISTS guards).
--
--  Target: PostgreSQL 14+
--  Safe to run on a database that already has these columns (no-ops).
-- =============================================================================

-- ── ctf_challenges: missing columns ──────────────────────────────────────────

ALTER TABLE ctf_challenges
    ADD COLUMN IF NOT EXISTS flag_type          VARCHAR(10)  DEFAULT 'STATIC',
    ADD COLUMN IF NOT EXISTS connection_type    VARCHAR(10)  DEFAULT 'HTTP',
    ADD COLUMN IF NOT EXISTS docker_flag_env    VARCHAR(64)  DEFAULT 'FLAG',
    ADD COLUMN IF NOT EXISTS docker_env_vars    JSONB,
    ADD COLUMN IF NOT EXISTS docker_memory_mb   INT          DEFAULT 128,
    ADD COLUMN IF NOT EXISTS docker_cpu_percent INT          DEFAULT 50,
    ADD COLUMN IF NOT EXISTS docker_pids_limit  INT          DEFAULT 100,
    ADD COLUMN IF NOT EXISTS initial_value      INT,
    ADD COLUMN IF NOT EXISTS minimum_value      INT          DEFAULT 50,
    ADD COLUMN IF NOT EXISTS decay_value        INT          DEFAULT 10;

-- ── ctf_competitions: missing scoring_function column ────────────────────────

ALTER TABLE ctf_competitions
    ADD COLUMN IF NOT EXISTS scoring_function VARCHAR(15) DEFAULT 'LOGARITHMIC';

-- ── ctf_instances: missing columns ───────────────────────────────────────────

ALTER TABLE ctf_instances
    ADD COLUMN IF NOT EXISTS connection_string VARCHAR(512),
    ADD COLUMN IF NOT EXISTS network_id        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS container_name    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS team_id           UUID REFERENCES ctf_teams(id),
    ADD COLUMN IF NOT EXISTS competition_id    UUID REFERENCES ctf_competitions(id),
    ADD COLUMN IF NOT EXISTS renewal_count     INT     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message     TEXT,
    ADD COLUMN IF NOT EXISTS stopped_at        TIMESTAMP,
    ADD COLUMN IF NOT EXISTS flag_value        VARCHAR(500);

-- ── ctf_awards: unified scoring table ────────────────────────────────────────
-- Scoreboard = SUM(value) per team — never a stored score column.
-- Positive value = solve credit; negative value = hint deduction.

CREATE TABLE IF NOT EXISTS ctf_awards (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID         REFERENCES ctf_competitions(id),
    user_id        UUID         REFERENCES users(id),
    team_id        UUID         REFERENCES ctf_teams(id),
    value          INTEGER      NOT NULL,
    reason         VARCHAR(255),
    awarded_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctf_awards_team
    ON ctf_awards (team_id, competition_id);

CREATE INDEX IF NOT EXISTS idx_ctf_awards_awarded_at
    ON ctf_awards (competition_id, awarded_at);

-- ── ctf_flags: practice-mode per-challenge flags ─────────────────────────────
-- type STATIC = exact match; REGEX = pattern match.
-- content stores plaintext flag or regex — never a hash.

CREATE TABLE IF NOT EXISTS ctf_flags (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id     UUID        NOT NULL REFERENCES ctf_challenges(id) ON DELETE CASCADE,
    type             VARCHAR(10) NOT NULL DEFAULT 'STATIC'
                                 CHECK (type IN ('STATIC', 'REGEX')),
    content          TEXT        NOT NULL,
    case_insensitive BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ctf_flags_challenge
    ON ctf_flags (challenge_id);

-- ── Additional indexes for instance queries ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ctf_instances_team_challenge
    ON ctf_instances (team_id, challenge_id)
    WHERE status IN ('STARTING', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_ctf_instances_port
    ON ctf_instances (assigned_port)
    WHERE status IN ('STARTING', 'RUNNING');

-- ── Challenge packaging and build tracking ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ctf_challenge_builds (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id     UUID         NOT NULL REFERENCES ctf_challenges(id) ON DELETE CASCADE,
  source_type      VARCHAR(10)  NOT NULL DEFAULT 'REGISTRY'
                                CHECK (source_type IN ('ZIP', 'REGISTRY')),
  zip_file_path    VARCHAR(500),
  zip_original_name VARCHAR(255),
  zip_sha256       VARCHAR(64),
  registry_url     VARCHAR(500),
  built_image_tag  VARCHAR(500),
  build_status     VARCHAR(15)  NOT NULL DEFAULT 'PENDING'
                                CHECK (build_status IN (
                                  'PENDING','BUILDING','READY','FAILED','PULLING','OUTDATED'
                                )),
  build_log        TEXT,
  build_started_at TIMESTAMP,
  build_finished_at TIMESTAMP,
  built_by         UUID         REFERENCES users(id),
  image_size_mb    INT,
  version          INT          NOT NULL DEFAULT 1,
  error_message    TEXT,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctf_builds_challenge
  ON ctf_challenge_builds(challenge_id);

ALTER TABLE ctf_resource_config
  ADD COLUMN IF NOT EXISTS max_zip_size_mb INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS build_timeout_seconds INT DEFAULT 300,
  ADD COLUMN IF NOT EXISTS zip_storage_path VARCHAR(255) DEFAULT '/data/ctf-uploads';

-- ── Seed the singleton resource-config row (id=1) ─────────────────────────────
-- CTFInstanceService reads this on every instance start; without it, /start 500s.
-- CTFResourceConfigService.getConfig() also self-heals at runtime, but seeding
-- here keeps fresh databases working from first boot.

INSERT INTO ctf_resource_config
  (id, max_concurrent_instances, max_instances_per_user, max_instance_duration_minutes,
   container_memory_limit_mb, container_cpu_percent, cleanup_interval_seconds)
VALUES (1, 50, 3, 30, 128, 50, 60)
ON CONFLICT (id) DO NOTHING;

-- ── Cheat-detection audit detail (2026-05-21) ────────────────────────────────
-- Record the exact member who submitted a cross-team flag, and persist every
-- competition submission (correct / wrong / cheat) so teachers have a full trail.
ALTER TABLE ctf_cheat_events
  ADD COLUMN IF NOT EXISTS submitting_user_id UUID;

ALTER TABLE ctf_submissions
  ADD COLUMN IF NOT EXISTS competition_id   UUID,
  ADD COLUMN IF NOT EXISTS team_id          UUID,
  ADD COLUMN IF NOT EXISTS is_cheat_flagged BOOLEAN NOT NULL DEFAULT FALSE;
