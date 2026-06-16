-- =============================================================================
--  migration_v23_concurrency_completion.sql
--
--  Backend completion + concurrency hardening. Adds:
--    - Optimistic-lock version columns on the scoreboard/exam aggregate rows.
--    - An idempotency claim flag on submissions (exactly-once scoring).
--    - A unique constraint on competition_submissions.submission_id (defence
--      in depth for the CP history idempotency record).
--    - Exam completion columns (passing score, grades-revealed flag).
--    - TP per-attempt duration column.
--
--  ADDITIVE ONLY:
--    - No DROP. No ALTER of existing column types.
--    - All new columns nullable or DEFAULTed so existing rows stay valid and
--      Hibernate ddl-auto=validate passes.
--    - Safe to run more than once (IF NOT EXISTS / guarded constraint).
--
--  TABLE NAMES (this codebase):
--    submissions               PK = submission_id
--    competition_attempt_stats unique (competition_id, problem_id, participant_id)
--    exam_attempt_results      unique (assessment_id, problem_id, student_id)
--    competition_submissions   has column submission_id
--    live_exams / open_tps     JOINED subtypes keyed by assessment_id
-- =============================================================================

-- 1.1 — idempotency claim flag (atomic markScoredIfUnscored)
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS scored BOOLEAN NOT NULL DEFAULT FALSE;

-- 1.2 — optimistic-lock backstops
ALTER TABLE competition_attempt_stats
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE exam_attempt_results
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- 1.1 — unique submission_id on the CP history row (idempotency record).
-- Guarded so the script is re-runnable and won't fail if already present.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_csub_submission_id'
    ) THEN
        ALTER TABLE competition_submissions
            ADD CONSTRAINT uq_csub_submission_id UNIQUE (submission_id);
    END IF;
END $$;

-- 2.1/2.3 — exam completion: pass/fail threshold + grade reveal gate
ALTER TABLE live_exams
    ADD COLUMN IF NOT EXISTS passing_score   INTEGER NOT NULL DEFAULT 50;

ALTER TABLE live_exams
    ADD COLUMN IF NOT EXISTS grades_revealed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2.4 — early close flag (entity already maps is_closed; ensure column exists)
ALTER TABLE live_exams
    ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;

-- 3.3 — optional per-attempt time window for TP (NULL = unlimited)
ALTER TABLE open_tps
    ADD COLUMN IF NOT EXISTS attempt_duration_minutes INTEGER NULL;
