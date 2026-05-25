-- ── CTF Challenge Library (v11) ────────────────────────────────────────────────
-- Adds library-ownership columns to ctf_challenges and makes competition_id
-- nullable so a challenge can belong to the library (no competition) or to a
-- specific competition.

ALTER TABLE ctf_challenges
  ADD COLUMN IF NOT EXISTS is_library      BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS library_owner_id UUID    REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS library_source_id UUID   REFERENCES ctf_challenges(id);

-- competition_id is now optional: NULL = library challenge, non-NULL = competition challenge.
ALTER TABLE ctf_challenges
  ALTER COLUMN competition_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ctf_challenges_library_owner
  ON ctf_challenges (library_owner_id)
  WHERE is_library = true AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_ctf_challenges_library_source
  ON ctf_challenges (library_source_id)
  WHERE deleted = false;
