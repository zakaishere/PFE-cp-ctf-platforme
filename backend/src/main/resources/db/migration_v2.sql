-- =============================================================================
--  migration_v2.sql
--  Extends the base schema.sql with Competition, Visibility, and JoinRequest
--  systems. Runs AFTER schema.sql on an already-initialised database.
--
--  Target: PostgreSQL 14+
--  Idempotent: safe to run more than once.
--  Run order within this file:
--    Section 1 (ALTER existing tables)
--    Section 2 (competition tables and their children)
--    Section 3 (join_requests)
--    Section 4 (FK from submissions → competitions)
--    Section 5 (rollback block — commented out)
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Modify Existing Tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. assessments — add visibility_mode
--     Covers LiveExam and OpenTP because they use JOINED inheritance from
--     assessments (every assessment row carries its own visibility setting).
-- -----------------------------------------------------------------------------
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS visibility_mode VARCHAR(20) NOT NULL DEFAULT 'MODULE_ONLY';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_visibility'
    ) THEN
        ALTER TABLE assessments
            ADD CONSTRAINT chk_assessments_visibility
                CHECK (visibility_mode IN ('MODULE_ONLY', 'ACCESS_CODE', 'REQUEST_BASED'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1b. live_exams — add is_closed and is_penalty_enabled
--     The LiveExam JPA entity stores these two flags in the live_exams table
--     (JOINED inheritance subtype), not in assessments.
--     • is_closed: set to TRUE by TeacherReviewController.closeExam(); triggers
--       auto-rejection of all pending join requests.
--     • is_penalty_enabled: governs whether wrong-answer penalties apply; the
--       entity defaults to TRUE (see @Builder.Default).
-- -----------------------------------------------------------------------------
ALTER TABLE live_exams
    ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE live_exams
    ADD COLUMN IF NOT EXISTS is_penalty_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- -----------------------------------------------------------------------------
-- 1c. submissions — add competition_id (nullable; set only for competition
--     submissions). The FK to competitions is deferred to Section 4 because
--     the competitions table does not exist yet at this point in the file.
-- -----------------------------------------------------------------------------
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS competition_id UUID;

-- -----------------------------------------------------------------------------
-- 1d. results — add teacher_penalty_override
--     Stored as DOUBLE PRECISION / nullable to match the Java entity field
--     `Double teacherPenaltyOverride`.  NULL means "no override applied".
--     The application reads it with a null-safe getOrDefault(0.0) pattern.
-- -----------------------------------------------------------------------------
ALTER TABLE results
    ADD COLUMN IF NOT EXISTS teacher_penalty_override DOUBLE PRECISION;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_results_penalty'
    ) THEN
        ALTER TABLE results
            ADD CONSTRAINT chk_results_penalty
                CHECK (teacher_penalty_override IS NULL OR teacher_penalty_override >= 0);
    END IF;
END $$;

-- =============================================================================
-- SECTION 2 — Competition Tables
--   Order: competitions → competition_problems → teams → team_members
--          → competition_registrations → competition_submissions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a. competitions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitions (
    competition_id   UUID         NOT NULL DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    created_by       UUID         NOT NULL,
    start_time       TIMESTAMPTZ  NOT NULL,
    duration_minutes INTEGER      NOT NULL,
    mode             VARCHAR(10)  NOT NULL DEFAULT 'SOLO',
    max_team_size    INTEGER      NOT NULL DEFAULT 1,
    status           VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    visibility_mode  VARCHAR(20)  NOT NULL DEFAULT 'REQUEST_BASED',
    is_public        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_competitions PRIMARY KEY (competition_id),
    CONSTRAINT fk_competitions_creator FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_competitions_mode
        CHECK (mode IN ('SOLO', 'TEAM')),
    CONSTRAINT chk_competitions_status
        CHECK (status IN ('DRAFT', 'REGISTRATION', 'ACTIVE', 'ENDED')),
    -- Competitions are never MODULE_ONLY — enforced in Java service layer too.
    CONSTRAINT chk_competitions_visibility
        CHECK (visibility_mode IN ('ACCESS_CODE', 'REQUEST_BASED')),
    CONSTRAINT chk_competitions_duration
        CHECK (duration_minutes > 0),
    CONSTRAINT chk_competitions_team_size
        CHECK (max_team_size BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_competitions_status     ON competitions (status);
CREATE INDEX IF NOT EXISTS idx_competitions_start_time ON competitions (start_time);
CREATE INDEX IF NOT EXISTS idx_competitions_created_by ON competitions (created_by);

-- -----------------------------------------------------------------------------
-- 2b. competition_problems  (join table with extra fields)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_problems (
    id             UUID    NOT NULL DEFAULT gen_random_uuid(),
    competition_id UUID    NOT NULL,
    problem_id     UUID    NOT NULL,
    order_index    INTEGER NOT NULL DEFAULT 0,
    points         INTEGER NOT NULL DEFAULT 500,

    CONSTRAINT pk_competition_problems  PRIMARY KEY (id),
    CONSTRAINT uq_competition_problem   UNIQUE (competition_id, problem_id),
    CONSTRAINT fk_cp_competition FOREIGN KEY (competition_id)
        REFERENCES competitions (competition_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_cp_problem FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_cp_points CHECK (points BETWEEN 100 AND 3000),
    CONSTRAINT chk_cp_order  CHECK (order_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cp_competition_id ON competition_problems (competition_id);
CREATE INDEX IF NOT EXISTS idx_cp_problem_id     ON competition_problems (problem_id);

-- -----------------------------------------------------------------------------
-- 2c. teams
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    team_id        UUID         NOT NULL DEFAULT gen_random_uuid(),
    competition_id UUID         NOT NULL,
    name           VARCHAR(100) NOT NULL,
    invite_code    VARCHAR(6)   NOT NULL,
    captain_id     UUID         NOT NULL,
    status         VARCHAR(10)  NOT NULL DEFAULT 'FORMING',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_teams PRIMARY KEY (team_id),
    CONSTRAINT uq_teams_invite_per_competition UNIQUE (competition_id, invite_code),
    CONSTRAINT uq_teams_name_per_competition   UNIQUE (competition_id, name),
    CONSTRAINT fk_teams_competition FOREIGN KEY (competition_id)
        REFERENCES competitions (competition_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_teams_captain FOREIGN KEY (captain_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_teams_status CHECK (status IN ('FORMING', 'LOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_teams_competition_id ON teams (competition_id);
CREATE INDEX IF NOT EXISTS idx_teams_invite_code    ON teams (invite_code);
CREATE INDEX IF NOT EXISTS idx_teams_captain_id     ON teams (captain_id);

-- -----------------------------------------------------------------------------
-- 2d. team_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id         UUID        NOT NULL DEFAULT gen_random_uuid(),
    team_id    UUID        NOT NULL,
    student_id UUID        NOT NULL,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_team_members            PRIMARY KEY (id),
    CONSTRAINT uq_team_members_student_team UNIQUE (team_id, student_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id)
        REFERENCES teams (team_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_tm_student FOREIGN KEY (student_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_tm_team_id    ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_tm_student_id ON team_members (student_id);

-- -----------------------------------------------------------------------------
-- 2e. competition_registrations  (solo mode only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_registrations (
    id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    competition_id UUID        NOT NULL,
    student_id     UUID        NOT NULL,
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_competition_registrations PRIMARY KEY (id),
    CONSTRAINT uq_competition_registration  UNIQUE (competition_id, student_id),
    CONSTRAINT fk_cr_competition FOREIGN KEY (competition_id)
        REFERENCES competitions (competition_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_cr_student FOREIGN KEY (student_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cr_competition_id ON competition_registrations (competition_id);
CREATE INDEX IF NOT EXISTS idx_cr_student_id     ON competition_registrations (student_id);

-- -----------------------------------------------------------------------------
-- 2f. competition_submissions
--     Mirrors the base submissions row with competition-specific metadata
--     (verdict enum, accumulated score, attempt counter). The submission_id
--     column links back to the existing submissions table so execution details
--     (source code, test results) are not duplicated.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_submissions (
    id                UUID        NOT NULL DEFAULT gen_random_uuid(),
    competition_id    UUID        NOT NULL,
    team_id           UUID,                   -- NULL when mode = SOLO
    student_id        UUID        NOT NULL,
    problem_id        UUID        NOT NULL,
    submission_id     UUID        NOT NULL,   -- FK → submissions
    verdict           VARCHAR(5)  NOT NULL,
    score             INTEGER     NOT NULL DEFAULT 0,
    attempt_number    INTEGER     NOT NULL DEFAULT 1,
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_time_ms BIGINT,

    CONSTRAINT pk_competition_submissions PRIMARY KEY (id),
    CONSTRAINT uq_cs_submission           UNIQUE (submission_id),
    CONSTRAINT fk_cs_competition FOREIGN KEY (competition_id)
        REFERENCES competitions (competition_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_cs_team FOREIGN KEY (team_id)
        REFERENCES teams (team_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_cs_student FOREIGN KEY (student_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_cs_problem FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_cs_submission FOREIGN KEY (submission_id)
        REFERENCES submissions (submission_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_cs_verdict
        CHECK (verdict IN ('AC', 'WA', 'TLE', 'MLE', 'CE', 'RTE')),
    CONSTRAINT chk_cs_score   CHECK (score >= 0),
    CONSTRAINT chk_cs_attempt CHECK (attempt_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_cs_competition_id ON competition_submissions (competition_id);
CREATE INDEX IF NOT EXISTS idx_cs_team_id        ON competition_submissions (team_id);
CREATE INDEX IF NOT EXISTS idx_cs_student_id     ON competition_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_cs_problem_id     ON competition_submissions (problem_id);
CREATE INDEX IF NOT EXISTS idx_cs_verdict        ON competition_submissions (verdict);
CREATE INDEX IF NOT EXISTS idx_cs_submitted_at   ON competition_submissions (submitted_at DESC);

-- Partial index: scoreboard queries filter heavily on AC verdicts.
CREATE INDEX IF NOT EXISTS idx_cs_accepted
    ON competition_submissions (competition_id, problem_id, submitted_at ASC)
    WHERE verdict = 'AC';

-- =============================================================================
-- SECTION 3 — join_requests
-- =============================================================================

-- Exactly one of assessment_id or competition_id must be non-null per row.
-- PostgreSQL's UNIQUE constraint treats NULLs as non-equal, so:
--   UNIQUE(assessment_id, student_id) only blocks a second row when
--   assessment_id is the *same non-null value*, which is the desired behaviour.
--
-- The version column supports @Version optimistic locking in the JPA entity;
-- Hibernate increments it on every UPDATE and raises OptimisticLockException
-- on a stale read — prevents two concurrent approve() calls from both
-- sending approval emails.

CREATE TABLE IF NOT EXISTS join_requests (
    request_id       UUID         NOT NULL DEFAULT gen_random_uuid(),
    assessment_id    UUID,                   -- NULL when request targets a competition
    competition_id   UUID,                   -- NULL when request targets an assessment
    student_id       UUID         NOT NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    message          VARCHAR(500),           -- optional note from student
    rejection_reason VARCHAR(500),           -- set on REJECTED, cleared on reversal
    requested_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    decided_at       TIMESTAMPTZ,            -- NULL until approved or rejected
    version          BIGINT       NOT NULL DEFAULT 0,   -- @Version optimistic locking

    CONSTRAINT pk_join_requests PRIMARY KEY (request_id),

    -- One request per student per assessment
    CONSTRAINT uq_jr_assessment_student  UNIQUE (assessment_id, student_id),
    -- One request per student per competition
    CONSTRAINT uq_jr_competition_student UNIQUE (competition_id, student_id),

    CONSTRAINT fk_jr_assessment FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_jr_competition FOREIGN KEY (competition_id)
        REFERENCES competitions (competition_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_jr_student FOREIGN KEY (student_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_jr_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

    -- Exactly one target: assessment XOR competition
    CONSTRAINT chk_jr_target CHECK (
        (assessment_id IS NOT NULL AND competition_id IS NULL) OR
        (assessment_id IS NULL     AND competition_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_jr_assessment_id  ON join_requests (assessment_id);
CREATE INDEX IF NOT EXISTS idx_jr_competition_id ON join_requests (competition_id);
CREATE INDEX IF NOT EXISTS idx_jr_student_id     ON join_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_jr_status         ON join_requests (status);

-- Partial indexes for the common teacher-side query "show me all pending requests".
CREATE INDEX IF NOT EXISTS idx_jr_pending_assessment
    ON join_requests (assessment_id, requested_at ASC)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_jr_pending_competition
    ON join_requests (competition_id, requested_at ASC)
    WHERE status = 'PENDING';

-- =============================================================================
-- SECTION 4 — Add FK from submissions → competitions
--   Must run after Section 2 so the competitions table already exists.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_submissions_competition'
    ) THEN
        ALTER TABLE submissions
            ADD CONSTRAINT fk_submissions_competition
                FOREIGN KEY (competition_id)
                REFERENCES competitions (competition_id)
                ON UPDATE CASCADE
                ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_competition_id
    ON submissions (competition_id);

-- =============================================================================
-- SECTION 5 — Rollback block
--   Run the statements below (uncommented) to undo this migration completely
--   and return the database to the schema.sql state.
-- =============================================================================
/*
-- Remove the FK first, then the column it references
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS fk_submissions_competition;
DROP INDEX  IF EXISTS idx_submissions_competition_id;
ALTER TABLE submissions DROP COLUMN IF EXISTS competition_id;

-- join_requests
DROP INDEX IF EXISTS idx_jr_pending_competition;
DROP INDEX IF EXISTS idx_jr_pending_assessment;
DROP INDEX IF EXISTS idx_jr_status;
DROP INDEX IF EXISTS idx_jr_student_id;
DROP INDEX IF EXISTS idx_jr_competition_id;
DROP INDEX IF EXISTS idx_jr_assessment_id;
DROP TABLE IF EXISTS join_requests CASCADE;

-- competition child tables (reverse dependency order)
DROP INDEX  IF EXISTS idx_cs_accepted;
DROP INDEX  IF EXISTS idx_cs_submitted_at;
DROP INDEX  IF EXISTS idx_cs_verdict;
DROP INDEX  IF EXISTS idx_cs_problem_id;
DROP INDEX  IF EXISTS idx_cs_student_id;
DROP INDEX  IF EXISTS idx_cs_team_id;
DROP INDEX  IF EXISTS idx_cs_competition_id;
DROP TABLE  IF EXISTS competition_submissions    CASCADE;

DROP INDEX  IF EXISTS idx_cr_student_id;
DROP INDEX  IF EXISTS idx_cr_competition_id;
DROP TABLE  IF EXISTS competition_registrations  CASCADE;

DROP INDEX  IF EXISTS idx_tm_student_id;
DROP INDEX  IF EXISTS idx_tm_team_id;
DROP TABLE  IF EXISTS team_members               CASCADE;

DROP INDEX  IF EXISTS idx_teams_captain_id;
DROP INDEX  IF EXISTS idx_teams_invite_code;
DROP INDEX  IF EXISTS idx_teams_competition_id;
DROP TABLE  IF EXISTS teams                      CASCADE;

DROP INDEX  IF EXISTS idx_cp_problem_id;
DROP INDEX  IF EXISTS idx_cp_competition_id;
DROP TABLE  IF EXISTS competition_problems       CASCADE;

DROP INDEX  IF EXISTS idx_competitions_created_by;
DROP INDEX  IF EXISTS idx_competitions_start_time;
DROP INDEX  IF EXISTS idx_competitions_status;
DROP TABLE  IF EXISTS competitions               CASCADE;

-- Revert alterations to existing tables
ALTER TABLE results     DROP CONSTRAINT IF EXISTS chk_results_penalty;
ALTER TABLE results     DROP COLUMN    IF EXISTS teacher_penalty_override;

ALTER TABLE live_exams  DROP COLUMN IF EXISTS is_penalty_enabled;
ALTER TABLE live_exams  DROP COLUMN IF EXISTS is_closed;

ALTER TABLE assessments DROP CONSTRAINT IF EXISTS chk_assessments_visibility;
ALTER TABLE assessments DROP COLUMN    IF EXISTS visibility_mode;
*/
