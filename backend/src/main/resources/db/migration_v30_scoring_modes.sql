-- Configurable scoring modes for Exam/TP. Both default to BEST_SUBMISSION,
-- preserving the current (only) behavior for every existing exam/TP.
ALTER TABLE live_exams ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) NOT NULL DEFAULT 'BEST_SUBMISSION';
ALTER TABLE open_tps   ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) NOT NULL DEFAULT 'BEST_SUBMISSION';
ALTER TABLE open_tps   ADD COLUMN IF NOT EXISTS penalty_percent INT NOT NULL DEFAULT 0;

-- exam_attempt_results already IS the per-(assessment,problem,student) score
-- table this feature needs (best_score/best_passed/best_total/attempts). Add
-- what's genuinely missing: last-attempt tracking (for exam LAST_SUBMISSION
-- mode), a "solved" flag + failed-attempt counter (for TP ATTEMPT_PENALTY),
-- and the final earned_score once scoring-mode + penalty are applied — kept
-- separate from best_score so best_score stays a transparent "raw best ever".
ALTER TABLE exam_attempt_results
  ADD COLUMN IF NOT EXISTS last_score      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_passed     INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_total      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS solved          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_attempts INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_score    INT     NOT NULL DEFAULT 0;

-- Backfill earned_score for existing rows so nothing regresses to 0 on read.
UPDATE exam_attempt_results SET earned_score = best_score WHERE earned_score = 0 AND best_score > 0;
UPDATE exam_attempt_results SET solved = true WHERE best_total > 0 AND best_passed = best_total;
