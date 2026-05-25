-- =============================================================================
--  migration_v3.sql
--  Adds problem_tags table for topic tagging on problems.
--
--  Target: PostgreSQL 14+
--  Idempotent: safe to run more than once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS problem_tags (
    problem_id UUID        NOT NULL,
    tag        VARCHAR(50) NOT NULL,

    CONSTRAINT fk_problem_tags_problem
        FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_problem_tags_problem_id ON problem_tags (problem_id);
