-- =============================================================================
--  Academic Problem-Solving & Evaluation Platform (PFE)
--  PostgreSQL Schema — generated from Spring Data JPA entities
--  Target: PostgreSQL 14+
--  Encoding: UTF-8
-- =============================================================================

-- Run order matters: parent tables before child tables.
-- To reset: run the DROP section at the bottom first.

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() fallback

-- =============================================================================
-- ██ IDENTITY BLOCK
-- =============================================================================

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    dept_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
    name      VARCHAR(150) NOT NULL,

    CONSTRAINT pk_departments PRIMARY KEY (dept_id),
    CONSTRAINT uq_departments_name UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- cohorts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cohorts (
    cohort_id     UUID         NOT NULL DEFAULT gen_random_uuid(),
    year          INTEGER      NOT NULL,
    semester      VARCHAR(20)  NOT NULL,
    department_id UUID         NOT NULL,

    CONSTRAINT pk_cohorts            PRIMARY KEY (cohort_id),
    CONSTRAINT fk_cohorts_department FOREIGN KEY (department_id)
        REFERENCES departments (dept_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,          -- cascade from Department.removeCohort
    CONSTRAINT uq_cohort_dept_year_semester
        UNIQUE (department_id, year, semester)
);

CREATE INDEX IF NOT EXISTS idx_cohorts_department_id ON cohorts (department_id);

-- -----------------------------------------------------------------------------
-- users  (base table — JOINED inheritance discriminator = user_type)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    user_type     VARCHAR(20)  NOT NULL,   -- Hibernate discriminator

    CONSTRAINT pk_users      PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role
        CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- -----------------------------------------------------------------------------
-- students  (JOINED subtype of users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    user_id        UUID         NOT NULL,
    apogee_number  VARCHAR(50)  NOT NULL,
    total_points   INTEGER      NOT NULL DEFAULT 0,
    cohort_id      UUID,                   -- nullable: student may be unassigned

    CONSTRAINT pk_students           PRIMARY KEY (user_id),
    CONSTRAINT fk_students_user      FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_students_cohort    FOREIGN KEY (cohort_id)
        REFERENCES cohorts (cohort_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT uq_students_apogee    UNIQUE (apogee_number),
    CONSTRAINT chk_students_points   CHECK (total_points >= 0)
);

CREATE INDEX IF NOT EXISTS idx_students_apogee    ON students (apogee_number);
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON students (cohort_id);

-- -----------------------------------------------------------------------------
-- teachers  (JOINED subtype of users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    user_id   UUID         NOT NULL,
    specialty VARCHAR(150),
    status    VARCHAR(20)  NOT NULL DEFAULT 'PENDING',

    CONSTRAINT pk_teachers       PRIMARY KEY (user_id),
    CONSTRAINT fk_teachers_user  FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_teachers_status
        CHECK (status IN ('PENDING', 'ACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers (status);

-- -----------------------------------------------------------------------------
-- admins  (JOINED subtype of users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    user_id     UUID    NOT NULL,
    admin_level INTEGER NOT NULL,

    CONSTRAINT pk_admins      PRIMARY KEY (user_id),
    CONSTRAINT fk_admins_user FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_admins_level CHECK (admin_level > 0)
);

-- =============================================================================
-- ██ ASSESSMENT BLOCK
-- =============================================================================

-- -----------------------------------------------------------------------------
-- assessments  (base table — JOINED inheritance discriminator = assessment_type)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
    assessment_id   UUID         NOT NULL DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
    assessment_type VARCHAR(20)  NOT NULL,   -- Hibernate discriminator: 'LIVE_EXAM' | 'OPEN_TP'
    teacher_id      UUID,                    -- nullable: teacher may be deactivated
    module_id       UUID,                    -- like most other drift found: never captured in SQL before

    CONSTRAINT pk_assessments        PRIMARY KEY (assessment_id),
    CONSTRAINT fk_assessments_teacher FOREIGN KEY (teacher_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_teacher_id ON assessments (teacher_id);

-- -----------------------------------------------------------------------------
-- live_exams  (JOINED subtype of assessments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_exams (
    assessment_id        UUID         NOT NULL,
    scheduled_start_time TIMESTAMPTZ  NOT NULL,
    duration_minutes     INTEGER      NOT NULL,
    strict_access_code   VARCHAR(100),

    CONSTRAINT pk_live_exams       PRIMARY KEY (assessment_id),
    CONSTRAINT fk_live_exams_base  FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_live_exams_duration CHECK (duration_minutes > 0)
);

-- -----------------------------------------------------------------------------
-- open_tps  (JOINED subtype of assessments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS open_tps (
    assessment_id     UUID        NOT NULL,
    deadline          TIMESTAMPTZ NOT NULL,
    max_attempts_allowed INTEGER  NOT NULL DEFAULT 1,

    CONSTRAINT pk_open_tps       PRIMARY KEY (assessment_id),
    CONSTRAINT fk_open_tps_base  FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_open_tps_attempts CHECK (max_attempts_allowed > 0)
);

-- -----------------------------------------------------------------------------
-- assessment_cohorts  (M:N join table — Assessment ↔ Cohort)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_cohorts (
    assessment_id UUID NOT NULL,
    cohort_id     UUID NOT NULL,

    CONSTRAINT pk_assessment_cohorts   PRIMARY KEY (assessment_id, cohort_id),
    CONSTRAINT fk_ac_assessment        FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_ac_cohort            FOREIGN KEY (cohort_id)
        REFERENCES cohorts (cohort_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- problems
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
    problem_id       UUID         NOT NULL DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    difficulty_level VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    time_limit_ms    INTEGER      NOT NULL DEFAULT 2000,
    memory_limit_mb  INTEGER      NOT NULL DEFAULT 256,
    is_public        BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_problems       PRIMARY KEY (problem_id),
    CONSTRAINT chk_problems_difficulty
        CHECK (difficulty_level IN ('EASY', 'MEDIUM', 'HARD')),
    CONSTRAINT chk_problems_time_limit   CHECK (time_limit_ms   > 0),
    CONSTRAINT chk_problems_memory_limit CHECK (memory_limit_mb  > 0)
);

CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_problems_is_public  ON problems (is_public);

-- -----------------------------------------------------------------------------
-- assessment_problems  (M:N join with extra data — Assessment ↔ Problem)
-- -----------------------------------------------------------------------------
-- `id`/`order_index`/`max_points` were, like the CTF tables above, only ever
-- added by Hibernate ddl-auto:update (migration_v22 adds max_points only —
-- id/order_index were never captured anywhere in SQL). `problem_order` is a
-- superseded column the entity no longer maps; kept for column-order fidelity
-- with the real dump (docs/documents/schema.sql) — Hibernate validate only
-- checks columns the entity actually maps, so its presence is harmless.
CREATE TABLE IF NOT EXISTS assessment_problems (
    assessment_id   UUID    NOT NULL,
    problem_id      UUID    NOT NULL,
    problem_order   INTEGER NOT NULL DEFAULT 0,
    points_override INTEGER,             -- null → use problem default scoring
    id              UUID    NOT NULL,
    order_index     INTEGER NOT NULL,
    max_points      INTEGER DEFAULT 25,

    CONSTRAINT pk_assessment_problems PRIMARY KEY (assessment_id, problem_id),
    CONSTRAINT fk_ap_assessment       FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_ap_problem          FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT            -- prevent deleting a problem used in an exam
);

-- If this table already existed (e.g. from an earlier boot before these
-- columns were added here), CREATE TABLE IF NOT EXISTS above silently did
-- nothing — it only applies to a table that doesn't exist yet. These
-- ADD COLUMN IF NOT EXISTS are unconditional so the columns are guaranteed
-- present before the constraint below tries to reference order_index.
ALTER TABLE assessment_problems
  ADD COLUMN IF NOT EXISTS id          UUID,
  ADD COLUMN IF NOT EXISTS order_index INTEGER,
  ADD COLUMN IF NOT EXISTS max_points  INTEGER DEFAULT 25;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_ap_assessment_order' AND table_name = 'assessment_problems'
  ) THEN
    ALTER TABLE assessment_problems ADD CONSTRAINT uq_ap_assessment_order UNIQUE (assessment_id, order_index);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_ap_assessment_problem' AND table_name = 'assessment_problems'
  ) THEN
    ALTER TABLE assessment_problems ADD CONSTRAINT uq_ap_assessment_problem UNIQUE (assessment_id, problem_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- test_cases  (1:N from problems, Cascade.ALL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_cases (
    test_case_id    UUID    NOT NULL DEFAULT gen_random_uuid(),
    problem_id      UUID    NOT NULL,
    input_data      TEXT    NOT NULL,
    expected_output TEXT    NOT NULL,
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_test_cases      PRIMARY KEY (test_case_id),
    CONSTRAINT fk_test_cases_problem FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE             -- Cascade.ALL from Problem → TestCase
);

CREATE INDEX IF NOT EXISTS idx_test_cases_problem_id ON test_cases (problem_id);

-- =============================================================================
-- ██ EXECUTION BLOCK
-- =============================================================================

-- -----------------------------------------------------------------------------
-- submissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    submission_id  UUID        NOT NULL DEFAULT gen_random_uuid(),
    source_code    TEXT        NOT NULL,
    language       VARCHAR(30) NOT NULL,
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempt_number INTEGER     NOT NULL DEFAULT 1,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_planning_mode BOOLEAN   NOT NULL DEFAULT FALSE,
    student_id     UUID        NOT NULL,
    problem_id     UUID        NOT NULL,
    assessment_id  UUID,                  -- NULLABLE: practice submission


    CONSTRAINT pk_submissions            PRIMARY KEY (submission_id),
    CONSTRAINT fk_submissions_student    FOREIGN KEY (student_id)
        REFERENCES students (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_submissions_problem    FOREIGN KEY (problem_id)
        REFERENCES problems (problem_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_submissions_assessment FOREIGN KEY (assessment_id)
        REFERENCES assessments (assessment_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_submissions_language
        CHECK (language IN ('JAVA','PYTHON','C','CPP','JAVASCRIPT','KOTLIN')),
    CONSTRAINT chk_submissions_status
        CHECK (status IN ('PENDING','COMPLETED')),
    CONSTRAINT chk_submissions_attempt   CHECK (attempt_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id    ON submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id    ON submissions (problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assessment_id ON submissions (assessment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status        ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_timestamp     ON submissions (timestamp DESC);

-- Partial index: fast queue-worker scan for PENDING jobs
CREATE INDEX IF NOT EXISTS idx_submissions_pending
    ON submissions (timestamp ASC)
    WHERE status = 'PENDING';

-- -----------------------------------------------------------------------------
-- results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
    result_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
    status          VARCHAR(20) NOT NULL,
    execution_time_ms INTEGER,           -- null if compile error (never ran)
    memory_used_mb    INTEGER,           -- null if compile error
    points_awarded    INTEGER   NOT NULL DEFAULT 0,
    feedback          TEXT,
    submission_id     UUID      NOT NULL,

    CONSTRAINT pk_results            PRIMARY KEY (result_id),
    CONSTRAINT uq_results_submission UNIQUE (submission_id),   -- enforces 1-to-1
    CONSTRAINT fk_results_submission FOREIGN KEY (submission_id)
        REFERENCES submissions (submission_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,             -- orphanRemoval on Submission side
    CONSTRAINT chk_results_status
        CHECK (status IN ('PASS','FAIL','ERROR','TIME_OUT','MEMORY_OUT')),
    CONSTRAINT chk_results_points    CHECK (points_awarded >= 0)
);

CREATE INDEX IF NOT EXISTS idx_results_submission_id ON results (submission_id);
CREATE INDEX IF NOT EXISTS idx_results_status        ON results (status);

-- =============================================================================
-- CTF BASE TABLES
-- These 8 tables were, historically, never captured as CREATE TABLE anywhere
-- in schema.sql or any migration_v*.sql — every migration touching them
-- (starting at migration_v4_ctf.sql) is an ALTER TABLE / REFERENCES that
-- assumes they already exist, because in every environment up to now they
-- were silently materialized by Hibernate's ddl-auto:update from the JPA
-- entities and that base creation was simply never exported to SQL.
-- migration_v10_ctf_schema_gaps.sql's own header says as much: "Documents
-- and fills schema gaps that Hibernate ddl-auto:update was silently
-- creating" — but it only ever patched columns on tables it assumed
-- existed, not the base tables themselves.
--
-- Column shapes below are taken directly from the current JPA entities
-- (ctf/entity/*.java), not from migration-file intent, since Hibernate's
-- ddl-auto=validate checks types/lengths against the entity mapping and a
-- couple of migration files disagree with the entity on VARCHAR length
-- (e.g. ctf_instances.network_id: entity says 128, migration_v10 says 255 —
-- entity wins). Every later `ADD COLUMN IF NOT EXISTS` for a column already
-- included here becomes a harmless no-op.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ctf_competitions (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title                VARCHAR(255) NOT NULL,
    description          TEXT,
    start_time           TIMESTAMP,
    end_time             TIMESTAMP,
    max_team_size        INT          DEFAULT 4,
    min_team_size        INT          DEFAULT 1,
    scoring_mode         VARCHAR(10)  DEFAULT 'DYNAMIC',
    dynamic_min_points   INT          DEFAULT 50,
    dynamic_decay_factor DOUBLE PRECISION DEFAULT 0.08,
    visibility           VARCHAR(20)  DEFAULT 'PUBLIC',
    access_code          VARCHAR(20),
    banner_url           VARCHAR(500),
    created_by           UUID,
    created_at           TIMESTAMP    DEFAULT NOW(),
    is_active            BOOLEAN      DEFAULT TRUE,
    is_paused            BOOLEAN      DEFAULT FALSE,
    is_frozen            BOOLEAN      DEFAULT FALSE,
    paused_at            TIMESTAMP,
    frozen_at            TIMESTAMP,
    scoring_function      VARCHAR(15) DEFAULT 'LOGARITHMIC',
    timing_mode          VARCHAR(15)  NOT NULL DEFAULT 'SCHEDULED',
    duration_hours       INT,
    registration_open    BOOLEAN      NOT NULL DEFAULT FALSE,
    is_manually_started  BOOLEAN      NOT NULL DEFAULT FALSE,
    manually_ended       BOOLEAN      NOT NULL DEFAULT FALSE,
    cover_image_url      VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS ctf_teams (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id       UUID         NOT NULL,
    name                 VARCHAR(50)  NOT NULL,
    invite_code          VARCHAR(10)  NOT NULL UNIQUE,
    avatar_color         VARCHAR(7)   DEFAULT '#6366f1',
    captain_id           UUID,
    is_disqualified      BOOLEAN      NOT NULL DEFAULT FALSE,
    disqualified_at      TIMESTAMP,
    disqualified_reason  VARCHAR(500),
    created_at           TIMESTAMP    DEFAULT NOW(),
    UNIQUE (competition_id, name)
);

CREATE TABLE IF NOT EXISTS ctf_challenges (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   VARCHAR(255) NOT NULL,
    description             TEXT         NOT NULL,
    category                VARCHAR(20)  NOT NULL,
    difficulty              VARCHAR(10)  NOT NULL,
    base_points             INT          NOT NULL,
    flag_hash               VARCHAR(64)  NOT NULL,
    flag_value              VARCHAR(500),
    flag_type               VARCHAR(10)  NOT NULL DEFAULT 'STATIC',
    flag_format             VARCHAR(100) DEFAULT 'FLAG{?}',
    requires_instance       BOOLEAN      DEFAULT FALSE,
    docker_image            VARCHAR(255),
    container_port          INT,
    container_env_vars      JSONB,
    docker_flag_env         VARCHAR(64)  DEFAULT 'FLAG',
    connection_type         VARCHAR(10)  DEFAULT 'HTTP',
    docker_env_vars         JSONB,
    docker_memory_mb        INT,
    docker_cpu_percent      INT,
    docker_pids_limit       INT,
    downloadable_file_url   VARCHAR(500),
    downloadable_file_name  VARCHAR(255),
    media_url               VARCHAR(500),
    hints                   JSONB,
    initial_value           INT,
    minimum_value           INT,
    decay_value             INT,
    max_attempts            INT          DEFAULT 10,
    is_active               BOOLEAN      DEFAULT TRUE,
    is_hidden               BOOLEAN      DEFAULT TRUE,
    author_id               UUID,
    author_name             VARCHAR(255),
    ssh_username            VARCHAR(100),
    ssh_password            VARCHAR(100),
    competition_id          UUID,
    is_library              BOOLEAN      NOT NULL DEFAULT FALSE,
    library_owner_id        UUID,
    library_source_id       UUID,
    blood_bonus_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
    first_blood_bonus       INT          NOT NULL DEFAULT 0,
    second_blood_bonus      INT          NOT NULL DEFAULT 0,
    third_blood_bonus       INT          NOT NULL DEFAULT 0,
    deleted                 BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    created_at              TIMESTAMP,
    updated_at              TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ctf_instances (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id       UUID,
    user_id            UUID,
    team_id            UUID,
    competition_id     UUID,
    container_id       VARCHAR(255),
    container_name     VARCHAR(128),
    network_id         VARCHAR(128),
    assigned_port      INT,
    connection_string  VARCHAR(512),
    flag_value         VARCHAR(255),
    status             VARCHAR(20)  DEFAULT 'STARTING',
    error_message      TEXT,
    started_at         TIMESTAMP    DEFAULT NOW(),
    expires_at         TIMESTAMP    NOT NULL,
    stopped_at         TIMESTAMP,
    renewal_count      INT          DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ctf_submissions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id   UUID,
    challenge_id     UUID,
    team_id          UUID,
    user_id          UUID,
    submitted_value  VARCHAR(500) NOT NULL,
    is_correct       BOOLEAN      NOT NULL,
    attempt_number   INT          NOT NULL,
    submitted_at     TIMESTAMP    DEFAULT NOW(),
    ip_address       VARCHAR(45),
    user_agent       VARCHAR(500),
    is_cheat_flagged BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ctf_cheat_events (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id      UUID,
    challenge_id        UUID,
    submitting_team     UUID,
    submitting_user_id  UUID,
    source_team         UUID,
    submitted_value     VARCHAR(500),
    detected_at         TIMESTAMP    DEFAULT NOW(),
    dismissed           BOOLEAN      NOT NULL DEFAULT FALSE,
    dismissed_at        TIMESTAMP,
    dismissed_by        UUID
);

CREATE TABLE IF NOT EXISTS ctf_hint_unlocks (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id   UUID,
    user_id        UUID,
    team_id        UUID,
    hint_id        VARCHAR(50) NOT NULL,
    points_spent   INT         NOT NULL,
    unlocked_at    TIMESTAMP   DEFAULT NOW()
);

-- The 8 tables below were found the same way as the 10 CTF tables above —
-- referenced/expected by the app but never captured as CREATE TABLE anywhere
-- (academic ones too: divisions/modules/semesters/exam_violations). Column
-- definitions are copied verbatim from docs/documents/schema.sql (a real
-- `pg_dump --schema-only` snapshot of a working instance — authoritative,
-- not hand-derived from entities like the 10 above), with CREATE TABLE
-- IF NOT EXISTS substituted for pg_dump's plain CREATE TABLE and PRIMARY
-- KEY/UNIQUE folded inline instead of pg_dump's separate ALTER TABLE form.

CREATE TABLE IF NOT EXISTS semesters (
    semester_id  UUID         PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS divisions (
    division_id  UUID         PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    dept_id      UUID         NOT NULL,
    type         VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS modules (
    module_id    UUID         PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    division_id  UUID         NOT NULL,
    semester_id  UUID         NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_violations (
    violation_id     UUID         PRIMARY KEY,
    "timestamp"      TIMESTAMP(6) NOT NULL,
    violation_type   VARCHAR(255) NOT NULL,
    assessment_id    UUID         NOT NULL,
    student_id       UUID         NOT NULL
);

CREATE TABLE IF NOT EXISTS competition_teams (
    team_id         UUID         PRIMARY KEY,
    captain_id      UUID         NOT NULL,
    competition_id  UUID         NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL,
    invite_code     VARCHAR(10)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    status          VARCHAR(10)  NOT NULL
        CHECK (status IN ('FORMING', 'LOCKED'))
);

CREATE TABLE IF NOT EXISTS ctf_notifications (
    id              UUID         PRIMARY KEY,
    body            TEXT,
    competition_id  UUID         NOT NULL,
    metadata        JSONB,
    sent_at         TIMESTAMP(6),
    sent_by         UUID,
    title           VARCHAR(255) NOT NULL,
    type            VARCHAR(30)  NOT NULL
        CHECK (type IN (
            'COMPETITION_STARTED', 'COMPETITION_PAUSED', 'COMPETITION_RESUMED',
            'COMPETITION_ENDING_SOON', 'COMPETITION_ENDED', 'NEW_CHALLENGE',
            'CHALLENGE_UPDATED', 'HINT_ADDED', 'SCOREBOARD_FROZEN',
            'SCOREBOARD_UNFROZEN', 'TEAM_DISQUALIFIED', 'CUSTOM'
        ))
);

CREATE TABLE IF NOT EXISTS ctf_solves (
    id              UUID         PRIMARY KEY,
    challenge_id    UUID,
    points_awarded  INT          NOT NULL,
    solved_at       TIMESTAMP(6),
    user_id         UUID
);

CREATE TABLE IF NOT EXISTS ctf_team_flags (
    id              UUID         PRIMARY KEY,
    challenge_id    UUID,
    competition_id  UUID,
    flag_hash       VARCHAR(64)  NOT NULL,
    generated_at    TIMESTAMP(6),
    team_id         UUID,
    UNIQUE (competition_id, challenge_id, team_id)
);

CREATE TABLE IF NOT EXISTS ctf_team_members (
    team_id     UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    joined_at   TIMESTAMP   DEFAULT NOW(),
    role        VARCHAR(10) DEFAULT 'MEMBER',
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS ctf_competition_solves (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id  UUID,
    challenge_id    UUID,
    team_id         UUID,
    solved_by       UUID,
    solved_at       TIMESTAMP DEFAULT NOW(),
    points_awarded  INT       NOT NULL,
    UNIQUE (competition_id, challenge_id, team_id)
);

-- Singleton config row (id is application-assigned, always 1 — see
-- migration_v10_ctf_schema_gaps.sql's seed INSERT).
CREATE TABLE IF NOT EXISTS ctf_resource_config (
    id                             BIGINT  PRIMARY KEY,
    max_concurrent_instances       INT     DEFAULT 3,
    max_instances_per_user         INT     DEFAULT 1,
    max_instance_duration_minutes  INT     DEFAULT 30,
    container_memory_limit_mb      INT     DEFAULT 128,
    container_cpu_percent          INT     DEFAULT 50,
    cleanup_interval_seconds       INT     DEFAULT 60,
    updated_by                     UUID,
    updated_at                     TIMESTAMP
);

-- =============================================================================
-- ROLLBACK / TEARDOWN  (run this block to wipe everything cleanly)
-- =============================================================================
/*
DROP TABLE IF EXISTS results               CASCADE;
DROP TABLE IF EXISTS submissions           CASCADE;
DROP TABLE IF EXISTS test_cases           CASCADE;
DROP TABLE IF EXISTS assessment_problems  CASCADE;
DROP TABLE IF EXISTS assessment_cohorts   CASCADE;
DROP TABLE IF EXISTS open_tps             CASCADE;
DROP TABLE IF EXISTS live_exams           CASCADE;
DROP TABLE IF EXISTS assessments          CASCADE;
DROP TABLE IF EXISTS problems             CASCADE;
DROP TABLE IF EXISTS admins               CASCADE;
DROP TABLE IF EXISTS teachers             CASCADE;
DROP TABLE IF EXISTS students             CASCADE;
DROP TABLE IF EXISTS users                CASCADE;
DROP TABLE IF EXISTS cohorts              CASCADE;
DROP TABLE IF EXISTS departments          CASCADE;
*/
