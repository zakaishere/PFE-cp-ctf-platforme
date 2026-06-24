# Platform Audit Report

## 1 — Data Model

### Competition Entities

**Competition**
- `competitionId` UUID PK
- `title`, `description` String
- `createdBy` UUID
- `startTime` LocalDateTime, `durationMinutes` int → `getEndTime()` computed
- `mode` Enum: SOLO | TEAM; `maxTeamSize`, `minTeamSize` int
- `status` Enum: DRAFT → REGISTRATION → ACTIVE → ENDED
- `isPublic` boolean; `visibilityMode` Enum: REQUEST_BASED
- `penaltyEnabled` boolean, `penaltyMinutes` int
- `scoringMode` Enum: ICPC | RATED | PARTIAL
- `freezeAt` LocalDateTime, `freezeDurationMinutes` int
- `isScoreboardFrozen()` → true when `now > freezeAt && now < endTime`

**Team**
- `teamId` UUID PK; FK `competitionId`
- `name`, `inviteCode` (len 10) String
- `captainId` UUID; `status` Enum: FORMING | LOCKED

**TeamMember**
- `id` UUID PK; FK `teamId`, `studentId`; `joinedAt`; unique(teamId, studentId)

**CompetitionSubmission** (immutable history row)
- `id` UUID PK; FK `competitionId`, `teamId`(opt), `studentId`, `problemId`, `submissionId`
- `verdict` Enum: AC | WA | TLE | MLE | CE | RTE
- `score` int, `attemptNumber` int, `submittedAt`, `executionTimeMs` long

**CompetitionAttemptStats** (scoreboard source of truth)
- unique(competitionId, problemId, participantId)
- `team` boolean, `wrongAttempts` int, `firstSolvedAt`, `bestScore`, `lastScore`
- `solved` boolean, `penaltyMinutes` int

**CompetitionProblem** (M2M join with per-problem scoring config)
- unique(competitionId, problemId)
- `orderIndex`, `points`, `maxPoints`, `minPoints` int
- `decayPerMin` BigDecimal, `wrongPenalty` int
- `firstBloodParticipantId`, `firstBloodAt`

---

### Assessment Entities

**Assessment** (abstract base, joined-table inheritance)
- `assessmentId` UUID PK; `title`, `description`
- `isPublished` boolean; FK `createdBy` (Teacher); FK `module` (optional)
- `visibilityMode` Enum: MODULE_ONLY | ACCESS_CODE | REQUEST_BASED

**LiveExam** (discriminator `LIVE_EXAM`)
- `scheduledStartTime`, `durationMinutes`; `strictAccessCode`
- `isPenaltyEnabled` boolean; `isClosed` boolean

**OpenTP** (discriminator `OPEN_TP`)
- `deadline` LocalDateTime; `maxAttemptsAllowed` Integer (nullable)

**ExamProblem** (LiveExam ↔ Problem M2M)
- unique(liveExamId, problemId); `basePoints` int (default 500)

**ExamAttemptResult** (best-result per student per problem)
- unique(assessmentId, problemId, studentId)
- `bestScore`, `bestPassed`, `bestTotal` int; `attempts` int; `finalized` boolean

---

### Problem / Submission Entities

**Problem**
- `problemId` UUID PK; FK `teacherId`
- `title`, `description`; `timeLimitMs`, `memoryLimitMb` int
- `difficultyLevel` Enum: EASY | MEDIUM | HARD; `isPublic` boolean
- `category` String; `tags` List\<String\>; `hints` List\<String\> (ordered)
- 1-to-many `testCases` (cascade, orphan removal)

**TestCase**
- `testCaseId` UUID PK; FK `problemId`
- `inputData`, `expectedOutput` TEXT; `isHidden` boolean

**Submission**
- `submissionId` UUID PK
- FK `studentId`, `problemId`, `assessmentId`(opt), `competitionId`(opt)
- `sourceCode` TEXT; `language` Enum: JAVA | PYTHON | C | CPP | JAVASCRIPT | KOTLIN
- `timestamp`; `attemptNumber` int; `status` Enum: PENDING | COMPLETED
- `planningMode` boolean (only visible test cases run); `isAccepted` boolean
- 1-to-1 `result` (cascade)

**Result**
- `resultId` UUID PK; FK `submissionId` (unique)
- `status` Enum: PASS | FAIL | ERROR | TIME_OUT | MEMORY_OUT
- `executionTimeMs`, `memoryUsedMb` Integer; `pointsAwarded` Double
- `teacherPenaltyOverride` Double; `feedback` TEXT

---

## 2 — The Judge

**Verdict: REAL** (Docker, real compilers, sandboxed)

**File:** `DockerService.java`

Each language maps to a Docker image, compile command, and run command:

| Language | Image | Notes |
|----------|-------|-------|
| JAVA | `eclipse-temurin:17-jdk-alpine` | javac + java |
| PYTHON | `python:3.9-slim` | interpreted |
| C | gcc image | gcc |
| CPP | gcc image | g++ |
| JAVASCRIPT | node image | node |
| KOTLIN | kotlin image | kotlinc |

**Execution flow (`runBatch`):**
1. Write test inputs to host volume as `in_0.txt`, `in_1.txt`, ...
2. Run:
   ```
   docker run --rm --network none --memory Nm --cpus 0.5 \
     -v hostSrcPath:/src:ro \
     --tmpfs /app:rw,exec,size=100m \
     -w /app <image> sh -c "<compile>; <per-case runs>"
   ```
3. Parse markers `===CASE_i===`, `===TIME_Xms===`, `===EXIT_Y===` from stdout
4. Per-case timeout: `(timeLimitMs / 1000) + 2` seconds; global: per-case × count + 30s

**Verdict mapping:**

| Exit / Condition | Result | CP Verdict |
|------------------|--------|------------|
| exit 124 | TIME_OUT | TLE |
| exit ≠ 0, 0ms elapsed | ERROR | CE |
| exit ≠ 0, >0ms elapsed | ERROR | RTE |
| exit 0, output matches | PASS | AC |
| exit 0, output differs | FAIL | WA |

**Sandboxing:** `--network none`, read-only `/src`, tmpfs `/app`, cgroup memory + CPU. No seccomp policy beyond Docker default.

**Worker (`ExecutionWorkerService.java`):**
- Consumes from RabbitMQ `psp.submission.queue`
- Planning mode: only visible test cases run
- Grading mode: all test cases including hidden
- Pushes `TEST_CASE_RESULT` per case via WebSocket; stops after first failure
- Dispatches to `CompetitionScoringService` or `ExamScoringService` post-execution

**WebSocket push per test case:**
```json
{
  "type": "TEST_CASE_RESULT",
  "submissionId": "...",
  "index": 0,
  "status": "PASS|FAIL|ERROR|TIME_OUT|MEMORY_OUT",
  "executionTimeMs": 123,
  "actualOutput": "...",
  "inputData": null,
  "expectedOutput": null,
  "isHidden": true
}
```

---

## 3 — Scoring

### CP — Three modes (`CompetitionScoringService.java`)

**ICPC:** rank by solve count DESC, then penalty ASC.
```
penalty = minutesSinceStart + (wrongAttempts × wrongPenalty)
```
AC awards `maxPoints`; WA/CE/RTE increments `wrongAttempts`, awards 0.

**RATED (Decremental):**
```
score = max(minPoints, maxPoints - decayPerMin × minutesSinceStart - wrongPenalty × wrongAttempts)
```
Best score per participant kept.

**PARTIAL (Subtask):**
```
score = round(passedTestCases / totalTestCases × maxPoints)
```
Best score per participant kept; no time decay, no wrong-attempt penalty.

First blood tracked (`CompetitionProblem.firstBloodParticipantId/At`) but no bonus points awarded — recording only.

### Exam (LiveExam) — `ExamScoringService.java`

```
score = round(passed / total × maxPoints)   // maxPoints from AssessmentProblem (default 25)
```
Best submission per (assessment, problem, student) stored in `ExamAttemptResult`. Results hidden during exam, not pushed live.

Final grade: `sum(bestScore) / sum(maxPoints) × 100`.

### TP (OpenTP) — same formula, live push

Same partial formula. Score pushed live to `/user/{id}/queue/tp/score` after each submission.

### Global gamification (non-assessment CP)

```
pointsAwarded = EASY→10, MEDIUM→20, HARD→30   // all-or-nothing
```
Added to `Student.totalPoints`. Separate from competition scoring.

---

## 4 — Timing & Access

### Competition

Lifecycle service runs every 30s:
- `startTime` reached → REGISTRATION → ACTIVE (teams locked, pending joins rejected)
- `startTime + durationMinutes` reached → ACTIVE → ENDED

Submission guard in `SubmissionService.validateStudentAccess()`:
```java
if (now.isBefore(start) || now.isAfter(end)) throw FORBIDDEN
```

### Exam

Same time-window check at submission time:
```java
if (now.isBefore(scheduledStartTime) || now.isAfter(start + durationMinutes)) throw FORBIDDEN
```
No persistent "closed" flag used; purely time-based.

### TP

`OpenTP.deadline` stored. Lifecycle service auto-rejects PENDING join requests after deadline. **Submissions are NOT blocked after deadline** — only join requests are rejected.

### Join / Access modes

| Mode | Behavior |
|------|----------|
| MODULE_ONLY | Student must be in the module; no code needed |
| ACCESS_CODE | `strictAccessCode` validated at submission time |
| REQUEST_BASED | JoinRequest must be APPROVED; lifecycle rejects pending after deadline |

---

## 5 — Visibility / Scoreboard Privacy

**Scoreboard freeze:**
```java
public boolean isScoreboardFrozen() {
  return now.isAfter(freezeAt) && now.isBefore(endTime);
}
```
Teachers bypass freeze and always see full standings. Students see frozen state. Supported by `ScoreboardService`.

**Exam results:** Silent during exam (no live push). Revealed state not controlled by explicit endpoint — unclear trigger, likely time-based only.

**TP results:** Pushed live per submission.

**Global leaderboard:** `GET /api/leaderboard` — top 10 by `totalPoints`. Public, no auth required.

---

## 6 — API Surface

### Submission

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/submissions` | Submit code; queues job; returns PENDING |
| GET | `/api/submissions/{id}/result` | Poll verdict |
| GET | `/api/submissions/{id}/code` | Fetch own source |

### Assessment (Exam / TP)

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/assessments/exams` | Teacher | Create LiveExam |
| POST | `/api/assessments/tps` | Teacher | Create OpenTP |
| POST | `/api/assessments/{id}/problems/{problemId}` | Teacher | Attach problem |
| GET | `/api/assessments/{id}/student-view` | Student | Fetch problems (hidden until active) |
| GET | `/api/assessments/{id}/score` | Student | Final grade |
| GET | `/api/assessments` | Any | List accessible assessments |

### Competition

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/competitions` | Teacher/Admin | Create (DRAFT) |
| PUT | `/api/competitions/{id}/publish` | Teacher/Admin | Transition to REGISTRATION |
| POST | `/api/competitions/{id}/problems/{problemId}` | Teacher/Admin | Attach problem |
| GET | `/api/competitions/{id}` | Any | Detail |
| GET | `/api/competitions/{id}/scoreboard` | Any | Live scoreboard (freeze-aware) |
| POST | `/api/competitions/{id}/register` | Student | Solo registration |
| POST | `/api/competitions/{id}/teams` | Student | Create team |
| POST | `/api/competitions/{id}/teams/join` | Student | Join via invite code |

### Teacher Review

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/teacher/exams/{id}/submissions` | Paginated submission review |
| POST | `/api/teacher/submissions/{id}/penalty` | Manual penalty override |
| POST | `/api/exams/cheat-logs` | Log violation (tab-switch, etc.) |

### WebSocket Topics

| Topic | Events |
|-------|--------|
| `/topic/submissions/{id}` | TEST_CASE_RESULT, SUBMISSION_COMPLETE |
| `/topic/competitions/{id}/scoreboard` | SCOREBOARD_UPDATE |
| `/topic/competitions/{id}/status` | ACTIVE, ENDED |
| `/user/{id}/queue/tp/score` | TP live score |
| `/topic/students/{id}/notifications` | JOIN_REQUEST_REJECTED, etc. |

---

## 7 — Gaps by Mode

### CP — mostly complete

| Feature | Status | Gap |
|---------|--------|-----|
| Docker judge | Complete | — |
| ICPC/RATED/PARTIAL scoring | Complete | — |
| Scoreboard freeze | Complete | — |
| Real-time WebSocket | Complete | — |
| First blood | Partial | Tracked, no bonus points awarded |
| Submission rate limit | Stubbed | `RateLimitConfig` defined but unused in submit path |
| Team join-time penalty offset | Missing | All penalties from competition start, not team join time |
| PARTIAL tiebreaker | Missing | No secondary sort beyond best score |

### Exam (LiveExam) — penalty and visibility incomplete

| Feature | Status | Gap |
|---------|--------|-----|
| Time-window enforcement | Complete | — |
| Partial-credit scoring | Complete | — |
| Penalty system | **Stubbed** | `isPenaltyEnabled` flag + `teacherPenaltyOverride` field exist; `ExamScoringService` never reads either |
| Manual grade override | Partial | Field exists; application to final grade unclear |
| Early close endpoint | Missing | No way to close exam before scheduled end |
| "Reveal grades" endpoint | Missing | No explicit trigger; timing/state unclear |
| Question randomization | Missing | All students see same problem order |
| Retake policy | Missing | No per-student attempt cap for exams |

### TP (OpenTP) — most incomplete

| Feature | Status | Gap |
|---------|--------|-----|
| Live score push | Complete | — |
| Partial-credit scoring | Complete | — |
| Deadline (join requests) | Complete | Auto-rejected after deadline |
| Deadline (submissions) | **Stubbed** | `OpenTPLifecycleService` rejects joins only; submissions go through unrestricted |
| Max attempts enforcement | **Stubbed** | `maxAttemptsAllowed` stored; `SubmissionService` counts attempts but never rejects |
| Late-submission penalty | Missing | No time delta from deadline tracked |
| Re-grade on config change | Missing | No bulk recalculate endpoint |

### Cross-cutting

| Feature | Status |
|---------|--------|
| Plagiarism detection | `ExamViolation` logs only; no similarity check |
| MCQ / non-code questions | Not implemented; all problems require test cases |
| Optimistic locking on `ExamAttemptResult` | Race condition: read-then-write without lock |
| Cascade on problem/assessment delete | Unclear; submissions may become orphaned |

---

## Summary

The judge is **real** — Docker, real compilers, sandboxed execution, byte-by-byte output comparison, time and memory limits enforced. Not mocked.

**TP is the most broken.** Two backend stubs (deadline not enforced on submissions, `maxAttemptsAllowed` never checked) mean the TP UI is showing constraints that do not actually exist. Fix those two first, then address the Exam penalty logic.

| Module | Core feature | Status |
|--------|-------------|--------|
| CP | Docker judge | Complete |
| CP | ICPC/RATED/PARTIAL | Complete |
| CP | Scoreboard freeze | Complete |
| Exam | Time-window | Complete |
| Exam | Penalty system | Stubbed |
| Exam | Reveal grades | Missing |
| TP | Deadline enforcement | Stubbed (submissions not blocked) |
| TP | Max attempts | Stubbed (field present, not enforced) |
| TP | Live score push | Complete |
