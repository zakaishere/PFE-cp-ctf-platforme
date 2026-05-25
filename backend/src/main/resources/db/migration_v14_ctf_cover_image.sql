-- Migration v14: Add cover_image_url to ctf_competitions
ALTER TABLE ctf_competitions
    ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);
