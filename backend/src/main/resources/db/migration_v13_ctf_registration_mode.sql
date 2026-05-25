-- CTF Registration Timing Mode (2026-05-22)
-- Adds REGISTRATION to timing_mode values and the manually_ended flag.

ALTER TABLE ctf_competitions
  ADD COLUMN IF NOT EXISTS manually_ended BOOLEAN DEFAULT FALSE NOT NULL;

-- Drop old constraint that only covers SCHEDULED|DURATION|MANUAL, then recreate including REGISTRATION.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ctf_competitions_timing_mode_check'
      AND table_name = 'ctf_competitions'
  ) THEN
    ALTER TABLE ctf_competitions DROP CONSTRAINT ctf_competitions_timing_mode_check;
  END IF;

  ALTER TABLE ctf_competitions
    ADD CONSTRAINT ctf_competitions_timing_mode_check
      CHECK (timing_mode IN ('SCHEDULED', 'DURATION', 'MANUAL', 'REGISTRATION'));
END
$$;
