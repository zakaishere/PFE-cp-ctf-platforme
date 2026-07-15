-- v18: add team_id to ctf_hint_unlocks so idempotency is per-team (not per-user)
-- and add a partial unique index to prevent double-charging the same team for the same hint.

ALTER TABLE ctf_hint_unlocks
    ADD COLUMN IF NOT EXISTS team_id UUID;

-- Partial index: only applies when team_id is set (competition mode).
-- Practice-mode rows have team_id = NULL and are excluded intentionally.
CREATE UNIQUE INDEX IF NOT EXISTS ctf_hint_unlocks_hint_team_uq
    ON ctf_hint_unlocks (hint_id, team_id)
    WHERE team_id IS NOT NULL;
