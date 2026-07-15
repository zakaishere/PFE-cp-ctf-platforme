-- Adds a scoped visibility to problems so TP/exam builders don't see the
-- entire global bank. Backfills from the existing is_public flag so current
-- behavior (practice bank + unscoped picker calls) is unchanged: public
-- problems become GLOBAL, private ones become PRIVATE (visible only to their
-- creating teacher).
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'GLOBAL';

UPDATE problems SET visibility = CASE WHEN is_public THEN 'GLOBAL' ELSE 'PRIVATE' END;
