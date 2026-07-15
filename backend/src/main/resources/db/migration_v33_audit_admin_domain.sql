-- migration_v27_audit_admin_domain.sql
-- Widen the audit_events.domain CHECK constraint to allow the new ADMIN domain,
-- introduced for privileged admin actions (teacher approvals, CTF resource
-- config changes, instance force-stop, image prewarm).
--
-- Without this, every admin audit write violates chk_audit_domain and the whole
-- surrounding mutation transaction rolls back (409). See migration_v21.

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS chk_audit_domain;

ALTER TABLE audit_events
    ADD CONSTRAINT chk_audit_domain
        CHECK (domain IN ('CTF', 'EXAM', 'TP', 'CP', 'ADMIN'));
