-- =============================================================================
--  migration_v21_unified_audit.sql
--
--  Adds a single audit_events table that consolidates the three existing
--  domain-specific violation tables (ctf_cheat_events, exam_violations,
--  competition_violations) for unified querying and CSV export.
--
--  ADDITIVE ONLY:
--    - Old tables stay; their writers are kept.
--    - New writers call AuditEventService.record(...) in addition.
--    - Read migration off the old tables is a separate, later task.
--
--  Idempotent: safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          VARCHAR(16) NOT NULL,
    event_type      VARCHAR(48) NOT NULL,
    context_id      UUID        NOT NULL,    -- competition_id / assessment_id
    challenge_id    UUID,                    -- problem_id / challenge_id (nullable)
    actor_user_id   UUID        NOT NULL,
    actor_team_id   UUID,                    -- nullable (solo modes)
    source_team_id  UUID,                    -- e.g. owner of a stolen CTF flag
    detail          JSONB,                   -- submitted value, flags, metadata
    severity        VARCHAR(8)  NOT NULL DEFAULT 'INFO',
    dismissed       BOOLEAN     NOT NULL DEFAULT FALSE,
    dismissed_by    UUID,
    dismissed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_domain') THEN
        ALTER TABLE audit_events
            ADD CONSTRAINT chk_audit_domain
                CHECK (domain IN ('CTF','EXAM','TP','CP'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_severity') THEN
        ALTER TABLE audit_events
            ADD CONSTRAINT chk_audit_severity
                CHECK (severity IN ('INFO','WARN','CHEAT'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_context
    ON audit_events(domain, context_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_cheat
    ON audit_events(context_id, severity)
    WHERE severity = 'CHEAT';
