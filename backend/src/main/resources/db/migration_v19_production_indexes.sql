-- migration_v19_production_indexes.sql
-- Idempotent index additions for production performance.
-- Run BEFORE restarting the application (ddl-auto: validate).

-- 1. ctf_challenges: fast lookup by competition
CREATE INDEX IF NOT EXISTS idx_ctf_challenges_competition
    ON ctf_challenges(competition_id)
    WHERE deleted = false;

-- 2. ctf_competition_solves: time-ordered solve history per competition
CREATE INDEX IF NOT EXISTS idx_ctf_csolves_competition_time
    ON ctf_competition_solves(competition_id, solved_at DESC);

-- 3. ctf_hint_unlocks: hint lookup by team + challenge (used in buildChallengeDTO batch)
CREATE INDEX IF NOT EXISTS idx_ctf_hint_unlocks_team_challenge
    ON ctf_hint_unlocks(team_id, challenge_id);

-- 4. ctf_team_members: user membership lookup across competitions
CREATE INDEX IF NOT EXISTS idx_ctf_team_members_user
    ON ctf_team_members(user_id);

-- 5. ctf_teams: lookup by competition (scoreboard loop)
CREATE INDEX IF NOT EXISTS idx_ctf_teams_competition
    ON ctf_teams(competition_id);

-- 6. ctf_competitions: active competitions by owner
CREATE INDEX IF NOT EXISTS idx_ctf_competitions_owner
    ON ctf_competitions(created_by)
    WHERE is_active = true;

-- 7. ctf_submissions: rate-limit window queries (competition + team + submitted_at)
CREATE INDEX IF NOT EXISTS idx_ctf_submissions_team_time
    ON ctf_submissions(team_id, submitted_at DESC);

-- 8. Drop duplicate index on ctf_flags(challenge_id)
DROP INDEX IF EXISTS idx_ctf_flags_challenge_id;
