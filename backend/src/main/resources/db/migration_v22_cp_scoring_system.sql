-- =============================================================================
--  migration_v22_cp_scoring_system.sql
--
--  Adds configurable competition scoring (ICPC / RATED / PARTIAL), scoreboard
--  freeze, per-problem scoring config, first-blood tracking, a per-participant
--  attempt-stats aggregate, and exam/TP partial-credit result storage.
--
--  ADDITIVE ONLY:
--    - No DROP. No ALTER of existing column types.
--    - Only ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
--    - Existing scoring (CompetitionSubmission rows, exam grade) is untouched;
--      new aggregates are maintained alongside.
--
--  NOTE ON NAMES (this codebase, Hibernate-managed competition tables):
--    competitions      PK = competition_id
--    competition_teams PK = team_id          (NOT a table called "teams")
--    competition_problems PK = id
--    assessments       PK = assessment_id
--    problems          PK = problem_id
--    students          PK = user_id
--
--  Idempotent: safe to re-run.
-- =============================================================================

-- ── Competition: scoring mode + freeze ──────────────────────────────────────
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(8) NOT NULL DEFAULT 'ICPC';

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS freeze_at TIMESTAMP;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS freeze_duration_minutes INT DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'chk_competition_scoring_mode'
  ) THEN
    ALTER TABLE competitions
      ADD CONSTRAINT chk_competition_scoring_mode
      CHECK (scoring_mode IN ('ICPC','RATED','PARTIAL'));
  END IF;
END $$;

-- ── Per-problem scoring configuration + first blood ─────────────────────────
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS max_points    INT          DEFAULT 100;
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS min_points    INT          DEFAULT 0;
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS decay_per_min NUMERIC(6,2) DEFAULT 1.0;
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS wrong_penalty INT          DEFAULT 20;
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS first_blood_participant_id UUID;
ALTER TABLE competition_problems
  ADD COLUMN IF NOT EXISTS first_blood_at TIMESTAMP;

-- Backfill max_points from the existing per-problem `points` value so already
-- configured competitions keep their intended weights.
UPDATE competition_problems
   SET max_points = points
 WHERE points IS NOT NULL AND points > 0
   AND (max_points IS NULL OR max_points = 100);

-- ── Per-participant attempt stats (source of truth for the new scoreboard) ──
-- participant_id = team_id (TEAM mode) or student user_id (SOLO mode).
CREATE TABLE IF NOT EXISTS competition_attempt_stats (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id    UUID NOT NULL,
    problem_id        UUID NOT NULL,      -- problems.problem_id
    participant_id    UUID NOT NULL,      -- team_id or student user_id
    is_team           BOOLEAN NOT NULL DEFAULT FALSE,
    wrong_attempts    INT NOT NULL DEFAULT 0,
    first_solved_at   TIMESTAMP,
    best_score        INT NOT NULL DEFAULT 0,
    last_score        INT NOT NULL DEFAULT 0,
    is_solved         BOOLEAN NOT NULL DEFAULT FALSE,
    penalty_minutes   INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_attempt_stats UNIQUE (competition_id, problem_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_stats_comp_part
  ON competition_attempt_stats(competition_id, participant_id);

CREATE INDEX IF NOT EXISTS idx_attempt_stats_comp_prob
  ON competition_attempt_stats(competition_id, problem_id);

-- ── Exam / TP partial-credit results (best submission per student/problem) ──
ALTER TABLE assessment_problems
  ADD COLUMN IF NOT EXISTS max_points INT DEFAULT 25;

CREATE TABLE IF NOT EXISTS exam_attempt_results (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id  UUID NOT NULL,
    problem_id     UUID NOT NULL,
    student_id     UUID NOT NULL,
    best_score     INT NOT NULL DEFAULT 0,
    best_passed    INT NOT NULL DEFAULT 0,
    best_total     INT NOT NULL DEFAULT 0,
    attempts       INT NOT NULL DEFAULT 0,
    finalized      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at     TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_exam_attempt UNIQUE (assessment_id, problem_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_assessment_student
  ON exam_attempt_results(assessment_id, student_id);
