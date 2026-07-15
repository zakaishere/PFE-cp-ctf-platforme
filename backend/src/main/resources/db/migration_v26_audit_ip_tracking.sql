-- ============================================================================
-- Migration v26 — per-user-per-event IP tracking for multi-IP anti-cheat.
-- Feeds the existing audit_events flow: when a user is seen from >1 IP in the
-- same event, a MULTI_IP audit event (severity CRITICAL) is recorded so it
-- surfaces in the existing teacher/admin audit dashboard.
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_event_ips (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain       VARCHAR(16) NOT NULL,          -- CTF | EXAM | TP | CP
    context_id   UUID NOT NULL,                 -- competition / exam / tp id
    distinct_ips TEXT[] NOT NULL DEFAULT '{}',
    multi_ip     BOOLEAN NOT NULL DEFAULT false,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_event_ip UNIQUE (user_id, domain, context_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_ips_context
    ON user_event_ips (domain, context_id);
CREATE INDEX IF NOT EXISTS idx_user_event_ips_multi
    ON user_event_ips (domain, context_id, multi_ip) WHERE multi_ip = true;
