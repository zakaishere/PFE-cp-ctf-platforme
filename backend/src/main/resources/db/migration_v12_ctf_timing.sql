-- CTF Flexible Timing Modes (2026-05-22)
-- Adds three timing modes: SCHEDULED (fixed start+end), DURATION (start+hours), MANUAL (host-driven).
-- Also adds registration_open flag to allow teams to join after start.

ALTER TABLE ctf_competitions
  ADD COLUMN IF NOT EXISTS timing_mode       VARCHAR(15)  DEFAULT 'SCHEDULED' NOT NULL,
  ADD COLUMN IF NOT EXISTS duration_hours    INT,
  ADD COLUMN IF NOT EXISTS registration_open BOOLEAN      DEFAULT FALSE       NOT NULL,
  ADD COLUMN IF NOT EXISTS is_manually_started BOOLEAN    DEFAULT FALSE       NOT NULL;

-- start_time / end_time become optional for MANUAL mode competitions.
ALTER TABLE ctf_competitions ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE ctf_competitions ALTER COLUMN end_time   DROP NOT NULL;

-- Guard: only valid timing modes accepted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ctf_competitions_timing_mode_check'
      AND table_name = 'ctf_competitions'
  ) THEN
    ALTER TABLE ctf_competitions
      ADD CONSTRAINT ctf_competitions_timing_mode_check
        CHECK (timing_mode IN ('SCHEDULED', 'DURATION', 'MANUAL'));
  END IF;
END
$$;
