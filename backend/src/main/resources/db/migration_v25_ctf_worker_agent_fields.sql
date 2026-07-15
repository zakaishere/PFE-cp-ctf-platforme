-- ============================================================================
-- Migration v25 — CTF worker-agent era challenge fields (from CTF-icode merge)
-- author_name: display credit on challenges
-- ssh_username / ssh_password: connection credentials for SSH-type challenges
-- Safe to re-run.
-- ============================================================================

ALTER TABLE ctf_challenges ADD COLUMN IF NOT EXISTS author_name  VARCHAR(255);
ALTER TABLE ctf_challenges ADD COLUMN IF NOT EXISTS ssh_username VARCHAR(100);
ALTER TABLE ctf_challenges ADD COLUMN IF NOT EXISTS ssh_password VARCHAR(100);
