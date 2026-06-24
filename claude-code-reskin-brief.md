# Claude Code Brief — Reskin the platform to the new "Algora" dark theme (UI/UX only)

You are working inside an **existing, working** Next.js frontend for a competitive-programming / exams / TP / CTF platform (Spring Boot + PostgreSQL backend). The app already works: the judge runs, scoring works, CTF works, WebSockets stream results, auth works. **Your job is to refine the UI/UX only** — make the whole app look and feel like the new dark theme in the provided mockups — **without changing any behavior, logic, data, or backend contracts.**

Treat this as a careful, staged refactor of the **presentation layer only**. Do not "rebuild." Do not "improve" logic. Reskin.

---

## 0. ABSOLUTE RULES (do not break the app)

Read these as hard constraints. If a styling change would require violating one, stop and leave that piece untouched, then note it.

- **Do NOT modify backend code, database, API routes, request/response shapes, or env config.**
- **Do NOT change** data-fetching logic, React Query/SWR hooks, state management, auth flows, route paths, or **WebSocket subscriptions/handlers** (e.g. `TEST_CASE_RESULT`, scoreboard, TP score topics). These wire the judge and live features — leave them exactly as-is.
- **Do NOT rename or change props, function signatures, or context APIs** that carry logic. Only change markup and styles.
- **Do NOT remove existing features.** CTF must keep its existing flow and only get restyled.
- **Do NOT introduce a heavy UI framework** (no MUI/Chakra/Ant). Reuse what's there; add only lightweight primitives.
- **Preserve every existing route and page.** Restyle in place.
- Where logic and markup are tangled in one component, **extract a presentational sub-component** and style that — do not rewrite the logic.
- Work in **small, reviewable commits**, one area at a time. After each area: run the build and dev server, confirm the page renders and core interactions still fire.
- If anything is ambiguous, **prefer leaving behavior unchanged** and flag it in your summary.

---

## 1. AUDIT FIRST (before changing anything)

Produce a short report, no edits yet:
1. Styling approach in use (Tailwind? CSS Modules? styled-components? plain CSS?). Adapt the design system to whatever is already there.
2. The page/route map and the main shared components (nav, cards, buttons, tables, forms, problem view, editor, scoreboard).
3. Where the global theme/tokens live today (Tailwind config, a globals.css, a theme file).
4. Which components are reused across student / teacher / admin so restyling them once propagates.

Then proceed.

---

## 2. ESTABLISH THE DESIGN SYSTEM (one source of truth)

Create a single theme layer and make every component consume it. If Tailwind, put these in `tailwind.config` + CSS variables in globals; if CSS, a `theme.css` with variables. **Do not hardcode hex values in components** — use the tokens.

### Color tokens (dark navy, single accent)
```
--bg:        #080b14   /* app background, deepest */
--bg-2:      #0b0f1b   /* inputs, recessed areas, table headers */
--surface:   #111726   /* cards, panels */
--surface-2: #161d2f   /* hover, raised rows */
--line:      #1e2638   /* hairline borders */
--line-strong:#2a3346  /* stronger borders, button outlines */

--ink:   #e9edf7       /* primary text */
--ink-2: #98a1ba       /* secondary text */
--ink-3: #5e6880       /* tertiary / muted */

--accent:      #5d7cf7 /* single brand accent — used platform-wide */
--accent-2:    #7a93ff /* accent hover / active text on dark */
--accent-soft: rgba(93,124,247,.13)
--accent-ring: rgba(93,124,247,.32)

--success:#2dbd80  --success-soft:rgba(45,189,128,.13)   (text on dark: #4cd49b)
--warn:   #e0a23c  --warn-soft:rgba(224,162,60,.13)      (text on dark: #eeb866)
--danger: #f0697e  --danger-soft:rgba(240,105,126,.13)   (text on dark: #ff8497)

/* difficulty text */ easy:#4cd49b  medium:#eeb866  hard:#ff8497
--radius:13px   --radius-sm:9px
```

### Type
- UI/display font: **Plus Jakarta Sans** (weights 400/500/600/700).
- Mono / data / code / timers / IDs: **JetBrains Mono** (400/500).
- Load via `next/font/google`. Body letter-spacing `-0.01em`. Headings 700, tight tracking.

### Iconography
- **Use `lucide-react`** (line icons), sized 16–18px, `currentColor`.
- **No emojis anywhere.** If the current code uses emojis as icons, replace them with lucide equivalents.

### Build these shared primitives (match the mockups exactly), then use them everywhere:
`Button` (variants: primary / default / ghost / danger; sizes sm/md), `Card`, `Pill`/`StatusBadge` (live/open/scheduled/draft/ended with a leading dot), `Table` (dark header on `--bg-2`, hairline rows, hover `--surface-2`), `StatCard`, `NavBar`, `SegmentedControl`, `Switch`, `FormField` (label + control + hint), inputs/select/textarea (bg `--bg-2`, focus ring `--accent-soft`), `Stepper`, `Avatar`, `EmptyState`.

Subtle only: 1px borders, minimal shadow, no glow, no gradients except the small logo mark. Respect `prefers-reduced-motion`. Visible keyboard focus on all interactive elements.

---

## 3. APP SHELL

- Replace any sidebar with a **top navbar** (sticky, blurred, 62px): logo + brand name, primary links with lucide icons, right side = search, notifications, profile menu. Active link uses `--accent-soft` / `--accent-2`.
- The **brand name must be a single constant** (e.g. `APP_NAME = "Algora"`) imported everywhere — it's a placeholder and will change. Logo mark = first letter in a rounded accent tile.
- **Arena pages replace the navbar with an "event bar"** (event title, mode tag, timer/deadline, section tabs, participant/team identity). Same dark system, different top chrome.

---

## 4. RESKIN AREA-BY-AREA (in this order; build-check after each)

Use the provided mockups as the **visual source of truth** for layout, spacing, and components. Match structure and styling; keep the existing data wired in.

**Reference files (already downloaded):**
- `01-student-browse-dark.html` → design system + student browse (Home, Practice, Competitions, Exams, TP, CTF list, Leaderboard)
- `02-teacher-dark.html` → teacher dashboard, **create wizards (CP / Exam / TP)**, problem editor, problem bank, submissions
- `03-admin-dark.html` → admin panel (overview, users, events, modules, leaderboard, instances/worker health, settings)
- `cp-arena-mockup.html`, `exam-arena-mockup.html`, `tp-arena-mockup.html` → arena **layouts** (apply the tokens above; remove the per-mode colors and emojis; use the single accent + lucide icons)
- `cp-lobby-mockup.html` → lobby layout (**note: this mockup is light — convert it to the dark theme** with the tokens above)

### 4a. Student browse
Home (stat cards, "up next", recent activity), Practice (filter chips + dark table with difficulty colors + solved/attempted status), Competitions (grouped Live / Registration open / Ended by the existing status enum), Exams (access-code / pass-fail states), TP (deadline + attempts + partial-credit progress, never a countdown), CTF list (restyle existing), Leaderboard.

### 4b. Arena (the live taking experience)
Apply the dark theme to the existing arena components. **Keep all WebSocket wiring.**
- **CP:** problems rail with status, statement, submit panel, and the **live test-case runner** fed by the existing `TEST_CASE_RESULT` stream (cases fill in one by one, stop on first failure). Scoreboard tab (freeze-aware) and team panel.
- **Exam:** question navigator, solo, **judge feedback suppressed** (do not show hidden-case results live) — keep that existing behavior; just restyle. "Answer saved" + "results released after the exam."
- **TP:** task list, **live own-score** (existing TP score topic), attempts, partial credit. No scoreboard.

### 4c. Lobby / pre-start
Registration + team formation (invite code) + countdown to start; "Enter arena" enabled when the event goes ACTIVE. Convert the light lobby mockup to dark.

### 4d. Teacher dashboard + create wizards (highest-care area)
This is where the old UI was weakest. Match `02-teacher-dark.html` precisely:
- **Create flow:** a "choose type" step, then the form.
- **Competition = a 5-step Stepper** (Basics → Schedule → Format → Problems → Review). **Critically: show only the relevant fields per choice** — selecting ICPC / Rated / Partial reveals only that mode's scoring fields; Solo/Team reveals team size only for Team; freeze / access-code / attempt-duration are toggles that expand their settings. Bind each field to the existing create-competition payload (scoringMode, startTime, durationMinutes, mode, min/maxTeamSize, penalty, freeze, per-problem points).
- **Exam / TP:** sectioned single-page forms (Basics / Schedule & access / Questions or Settings / Tasks), bound to the existing assessment payloads (visibilityMode, access code, **passingScore**, deadline, **maxAttemptsAllowed**, optional attempt duration, basePoints).
- **Problem editor:** statement, limits (time/memory), difficulty, category, tags, hints, and a **test-case repeater** with a visible/hidden toggle per case.
- Overview with event cards (Monitor / Edit / Publish / Reveal grades), problem bank table, submission review.

> If the backend doesn't yet accept `passingScore` (exam) or an optional TP attempt-duration, **render the field but leave it wired to the existing payload / feature-flag it off** — do not invent backend changes here. Flag these in your summary as backend follow-ups.

### 4e. Admin
Match `03-admin-dark.html`: overview with system-health rows (platform server, worker/CTF agent, judge queue, database), Users (roles), all Events, Modules, global Leaderboard, **Instances/Worker** page (memory gauge, judge-queue depth, running instances with address + uptime + Stop), Settings. Wire to existing admin endpoints; where an endpoint doesn't exist yet, render the UI against a clearly-marked placeholder and flag it.

---

## 5. DESIGN RULES (apply throughout)
- One accent only. Status colors are for status, never decoration.
- No emojis. Lucide line icons only.
- Consistent components — one Button, one Card, one Table, one Pill everywhere.
- Generous spacing, hairline borders, restraint over flourish. It should read as a serious, professional product, not a flashy template.
- Tables for dense data; cards for events; the mono font for numbers, timers, IDs, code.

---

## 6. AFTER EACH AREA — VERIFY
- Run the project's build and lint; fix only what your changes caused.
- Start the dev server, open the area, confirm it renders and the **core interaction still works** (submit fires, scoreboard updates, wizard submits the same payload, login works).
- Commit with a clear message scoped to that area.

---

## 7. DONE WHEN
- Every page visually matches the mockups in the unified dark theme with a top navbar (and event bar in arenas).
- **All existing functionality still works** — judge, scoring, live results, CTF, auth — with zero backend changes.
- One token system + shared primitives; no stray hardcoded colors; no emojis.
- Build passes; brand name is a single swappable constant.
- You output a short summary of what changed per area and a list of any **backend follow-ups** you intentionally left (e.g. exam `passingScore`, TP deadline/attempt enforcement, reveal-grades endpoint, worker-health endpoints).

Start with Section 1 (the audit) and wait to confirm the styling approach before generating the token layer.
