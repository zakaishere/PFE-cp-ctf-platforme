-- =============================================================================
--  migration_v4_ctf.sql
--  CTFd-pattern improvements: flag table, awards table, per-challenge scoring
--  columns, and scoring-function column on competitions.
--
--  Target: PostgreSQL 14+
--  Idempotent: all statements use IF NOT EXISTS / IF EXISTS.
--  Append-only: does NOT touch tables created in prior migrations.
-- =============================================================================

-- ── CHANGE 1 (Section 3, 14): separate flags table ───────────────────────────
-- One challenge → many accepted flags.  type: STATIC | REGEX.
-- content stores plaintext flag or regex pattern (never a hash).
-- practice-mode CTFSubmissionService uses this table; competition mode uses
-- ctf_team_flags (DYNAMIC) or challenge.flag_hash (STATIC) — untouched.

CREATE TABLE IF NOT EXISTS ctf_flags (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id     UUID        NOT NULL
                                 REFERENCES ctf_challenges(id) ON DELETE CASCADE,
    type             VARCHAR(10) NOT NULL DEFAULT 'STATIC',
    content          TEXT        NOT NULL,
    case_insensitive BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ctf_flags_challenge_id ON ctf_flags (challenge_id);

-- ── CHANGE 2 (Section 14): awards table ──────────────────────────────────────
-- Unifies positive solve credits and negative hint deductions.
-- Scoreboard = SUM(ctf_awards.value) per team (never a stored score column).
-- reason examples: "solve:<challenge_id>", "hint:<hint_id>", "admin:<note>"

CREATE TABLE IF NOT EXISTS ctf_awards (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID        NOT NULL,
    team_id        UUID        NOT NULL,
    value          INTEGER     NOT NULL,
    reason         VARCHAR(255),
    awarded_at     TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctf_awards_competition_team
    ON ctf_awards (competition_id, team_id);
CREATE INDEX IF NOT EXISTS idx_ctf_awards_awarded_at
    ON ctf_awards (competition_id, awarded_at);


-- ── CHANGE 3 (Section 4, 15): per-challenge dynamic scoring columns ──────────
-- initial_value  → starting point value (replaces base_points for dynamic calcs)
-- minimum_value  → floor value (never goes below this)
-- decay_value    → decay rate (n at which score hits minimum)
-- These are nullable; challenges without them fall back to base_points / static mode.

ALTER TABLE ctf_challenges
    ADD COLUMN IF NOT EXISTS initial_value  INTEGER,
    ADD COLUMN IF NOT EXISTS minimum_value  INTEGER,
    ADD COLUMN IF NOT EXISTS decay_value    INTEGER;

-- ── CHANGE 3 (Section 4, 15): scoring function on competitions ───────────────
-- STATIC      → fixed base_points per challenge (no decay)
-- LINEAR      → CTFd linear decay formula
-- LOGARITHMIC → CTFd quadratic-decay formula (default)

ALTER TABLE ctf_competitions
    ADD COLUMN IF NOT EXISTS scoring_function VARCHAR(15) DEFAULT 'LOGARITHMIC';

-- ── CHANGE 4 (Docker instance system): challenge Docker fields ────────────────
-- docker_flag_env   → env var name where FLAG is injected (default "FLAG")
-- connection_type   → HTTP | TCP
-- docker_env_vars   → extra env vars as JSONB map (teacher-supplied, no FLAG key)
-- docker_memory_mb  → per-container memory limit override
-- docker_cpu_percent → per-container CPU quota override
-- docker_pids_limit → PID limit (prevents fork bombs)

ALTER TABLE ctf_challenges
    ADD COLUMN IF NOT EXISTS docker_flag_env   VARCHAR(64)  DEFAULT 'FLAG',
    ADD COLUMN IF NOT EXISTS connection_type   VARCHAR(10)  DEFAULT 'HTTP',
    ADD COLUMN IF NOT EXISTS docker_env_vars   JSONB,
    ADD COLUMN IF NOT EXISTS docker_memory_mb  INTEGER,
    ADD COLUMN IF NOT EXISTS docker_cpu_percent INTEGER,
    ADD COLUMN IF NOT EXISTS docker_pids_limit  INTEGER;

-- ── CHANGE 4: ctf_instances new columns ──────────────────────────────────────
-- team_id/competition_id → for competition mode (null = practice)
-- container_name         → deterministic name for re-attach
-- network_id             → per-instance isolated Docker network id
-- connection_string      → pre-built "host:port" or full URL
-- flag_value             → NEVER exposed to student API; only used inside container
-- error_message          → last Docker error for diagnostics

ALTER TABLE ctf_instances
    ADD COLUMN IF NOT EXISTS team_id          UUID,
    ADD COLUMN IF NOT EXISTS competition_id   UUID,
    ADD COLUMN IF NOT EXISTS container_name   VARCHAR(128),
    ADD COLUMN IF NOT EXISTS network_id       VARCHAR(128),
    ADD COLUMN IF NOT EXISTS connection_string VARCHAR(512),
    ADD COLUMN IF NOT EXISTS flag_value       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS error_message    TEXT;

CREATE INDEX IF NOT EXISTS idx_ctf_instances_team_challenge
    ON ctf_instances (team_id, challenge_id)
    WHERE status IN ('STARTING', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_ctf_instances_expires_status
    ON ctf_instances (expires_at, status);

CREATE INDEX IF NOT EXISTS idx_ctf_instances_competition
    ON ctf_instances (competition_id);

-- ── CHANGE 4: docker image registry ──────────────────────────────────────────
-- Tracks pre-pulled images per Docker host for pre-warming status.
-- status: PENDING | PULLING | READY | FAILED

CREATE TABLE IF NOT EXISTS ctf_docker_images (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    image_ref   VARCHAR(512) NOT NULL UNIQUE,
    status      VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    pulled_at   TIMESTAMP,
    error       TEXT
);
