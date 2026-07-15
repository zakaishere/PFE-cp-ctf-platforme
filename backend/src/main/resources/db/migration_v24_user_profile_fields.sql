-- ============================================================================
-- Migration v24 — user profile fields
-- Adds username / bio / avatar_url / created_at to users, backfills username
-- from the email local part + short id suffix, then enforces NOT NULL + unique.
-- Safe to re-run (IF NOT EXISTS guards everywhere).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS username   VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill username for existing users: email local part + first 6 chars of id
UPDATE users
SET username = LOWER(SPLIT_PART(email, '@', 1)) || '_' || SUBSTRING(id::text, 1, 6)
WHERE username IS NULL;

-- Backfill created_at for pre-existing rows
UPDATE users
SET created_at = NOW()
WHERE created_at IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Uniqueness + fast lookup for /api/profile/u/{username}
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
