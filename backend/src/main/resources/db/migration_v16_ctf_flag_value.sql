-- =============================================================================
--  migration_v16_ctf_flag_value.sql
--  Adds flag_value column to ctf_challenges for plaintext flag storage on
--  STATIC challenges (used to inject the correct flag into Docker containers).
--  NULL for DYNAMIC challenges — never exposed to students via any API.
--
--  Target: PostgreSQL 14+
--  Idempotent: uses IF NOT EXISTS guard.
-- =============================================================================

ALTER TABLE ctf_challenges
    ADD COLUMN IF NOT EXISTS flag_value VARCHAR(500);
