-- =============================================================================
--  migration_v15_ctf_attempt_limits.sql
--  Configurable attempt limits + persistent attempt history on CTF challenges.
--
--  NULL max_attempts = unlimited; positive integer = hard limit per team.
--  All existing rows keep their current value (default was 10).
--
--  Target: PostgreSQL 14+
--  Idempotent: all statements use IF NOT EXISTS / DROP NOT NULL guards.
-- =============================================================================

-- ── max_attempts: allow NULL to signal "unlimited" ───────────────────────────
-- The column was added by Hibernate ddl-auto with no explicit constraint.
-- This statement is a no-op if the column is already nullable.
ALTER TABLE ctf_challenges
    ALTER COLUMN max_attempts DROP NOT NULL;

-- ── Index: fast per-team attempt count used in limit enforcement ──────────────
CREATE INDEX IF NOT EXISTS idx_ctf_submissions_challenge_team
    ON ctf_submissions (challenge_id, team_id);

-- ── Index: fast per-challenge-user attempt lookup (practice mode) ─────────────
CREATE INDEX IF NOT EXISTS idx_ctf_submissions_challenge_user
    ON ctf_submissions (challenge_id, user_id);
