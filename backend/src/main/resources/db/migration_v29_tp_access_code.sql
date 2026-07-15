-- OpenTP never had an access-code column, so a TP created with
-- visibilityMode=ACCESS_CODE silently had no code to check against — the
-- code typed in the teacher's create form was accepted and discarded.
ALTER TABLE open_tps
  ADD COLUMN IF NOT EXISTS strict_access_code VARCHAR(100);
