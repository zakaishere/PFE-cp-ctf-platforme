-- migration_v20_blood_bonus.sql
-- Adds optional per-challenge blood bonus columns.
-- blood_bonus_enabled = false by default → zero-cost for existing competitions.
ALTER TABLE ctf_challenges
    ADD COLUMN IF NOT EXISTS blood_bonus_enabled  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS first_blood_bonus    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS second_blood_bonus   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS third_blood_bonus    INTEGER NOT NULL DEFAULT 0;
