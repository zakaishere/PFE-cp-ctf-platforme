-- Fixed samurai-avatar picker: one of 12 known ids, or NULL (initials fallback).
-- Distinct from the pre-existing avatar_url (arbitrary image URL, unused by the frontend).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(20) DEFAULT NULL;
