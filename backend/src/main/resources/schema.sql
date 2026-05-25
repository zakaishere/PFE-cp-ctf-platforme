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
CREATE TABLE IF NOT EXISTS assessment_problems (
    assessment_id   UUID    NOT NULL,
    problem_id      UUID    NOT NULL,
    problem_order   INTEGER NOT NULL DEFAULT 0,
    points_override INTEGER,             -- null → use problem default scoring

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
