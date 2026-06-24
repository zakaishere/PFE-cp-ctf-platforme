# Algora — UI Polish Prompts (run in order, one at a time)

These are five independent, one-shot prompts. Run them one at a time in Claude Code.
Each one is self-contained and does not depend on the others being done first,
except Prompt 1 which should go first since it affects every page.

---

---

# PROMPT 1 — Card elevation + global feel (run first)

**Goal:** Make the platform feel light, human-made, and smooth.
Kill the heavy/flat look without adding visual noise.

**Rules:** CSS/style changes only. No logic, no API, no component restructuring.
Touch only the global stylesheet / Tailwind config / shared Card component.

## Changes

### 1. Replace the card box-shadow globally
Find the `.card` class (or whatever shared card component/class is used platform-wide).
Replace any existing box-shadow with exactly this:

```css
box-shadow: 0 1px 3px rgba(0,0,0,.2), 0 0 0 1px rgba(255,255,255,.04);
```

This gives cards a subtle lift that reads as "elevated" on any screen without looking heavy.
Do not add glow, colored shadows, or gradients. One rule, applied once, propagates everywhere.

### 2. Tighten border opacity
Change `--line` from its current value to `#252d3d` — slightly less saturated.
Borders should be felt not seen. If the border is the first thing your eye goes to on a card, it's too strong.

### 3. Add micro-transitions to interactive elements
Add this to the global stylesheet once:

```css
.btn, .nav-item, .nlink, .na, .prow, .erow, .ftab, .tab, .act {
  transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
```

120ms is the threshold between "instant" and "animated." Under it feels native. Over it feels slow.
Do not add transform/scale animations — they feel heavy for a data platform.

### 4. Consistent border-radius
Audit every card, button, input, pill, and icon tile in the codebase.
Enforce: cards = `12px`, buttons = `10px`, inputs = `10px`, pills = `999px`, icon tiles = `10px`, small chips/tags = `6px`.
Replace any hardcoded radius values with the CSS variables `var(--r)` and `var(--r-sm)`.

### 5. Typography weight cleanup
Scan all pages for any `font-weight: 800` or `font-weight: 900` — replace with `700`.
Scan for `font-weight: 300` or `font-weight: 400` on body text — replace with `500` (Plus Jakarta Sans reads better at 500 for body at small sizes on dark backgrounds).
Page titles (h1): `700`. Section headers (h2/h3): `650`. Labels: `600`. Body: `500`. Muted/meta: `500` in `--ink-3`.

### Verify
Start dev server. Open home, problems page, exams list, competition lobby.
Cards should look lightly elevated, not flat. Hover states should feel instant, not sluggish.
No visual regressions. `tsc --noEmit` clean.

---

---

# PROMPT 2 — Student dashboard: urgency-first layout

**Goal:** When a student logs in, the first thing they see answers:
"What needs my attention right now?" — not their stats.
Stats are secondary. Urgency is primary.

**Rules:** Restructure the student dashboard layout and data display only.
Do not change any API calls or data fetching. Do not touch other pages.

## Changes

### 1. Reorder the dashboard sections

Current order (likely): greeting → stats → up-next → recent activity
New order:

```
Greeting (name + date, 2 lines max)
↓
Active right now  (if anything is live — contest running, exam open)
↓
Coming up         (next 48h — exams with access code, contests starting soon)
↓
In progress       (open TPs with deadlines, sorted by deadline ascending)
↓
Stats row         (small, horizontal — 4 numbers: solved / points / rank / contests)
↓
Recent activity   (last 5 submissions, compact)
```

### 2. "Active right now" section

If the student has a live contest or open exam right now:
Show a single prominent card — full width, slightly taller than normal cards.
Left side: event type icon + title + status pill ("Live" or "Open").
Right side: a countdown timer (for contests: time remaining; for exams: time remaining or "open until HH:MM") and a large primary "Enter" button.
If nothing is active: do not show this section at all (no empty state here — just skip it).

### 3. "Coming up" section

Max 3 cards in a row. Each card:
- Event type tag (EXAM / COMPETITION / TP) in small uppercase
- Title, bold
- Key info: date + time, access requirement if any
- Status: "Starts in Xh Xm" (mono font, warn color if under 2 hours) or "Access code required"
- Button: "View details" (ghost) or disabled "Locked" if before registration

If nothing coming up in 48h: skip the section silently.

### 4. "In progress" section (TPs)

List style, not cards — one row per open TP:
`[flask icon] TP title · Due in X days · [progress bar 120px wide] · X/Y pts · [Open button]`
Sorted by deadline ascending (most urgent first).
Progress bar: `height: 6px`, `border-radius: 6px`, `background: var(--line)`, fill in `--accent`.

### 5. Stats row — make it compact

Replace the current 4 large stat cards with a single horizontal row of 4 numbers.
Each item: label in `--ink-3` 11px uppercase + value in `--ink` 20px mono font, separated by a `1px solid var(--line)` vertical divider.
Wrap this whole row in one card with `padding: 14px 24px`.
It should feel like a footer to the greeting, not the hero of the page.

### 6. Recent activity — compact list

Max 5 rows. Each row: icon (check=solved, code=submitted, x=wrong) + "Solved X" or "Submitted to Y" + time ago in `--ink-3` mono.
No cards per row — just a list inside one card. `border-bottom: 1px solid var(--line)` between rows.

### Verify
Log in as a student. Dashboard shows urgency sections first, stats last.
If no active events: greeting → stats → recent activity (clean, not a wall of empty states).
`tsc --noEmit` clean. No other pages affected.

---

---

# PROMPT 3 — Progressive disclosure on create forms

**Goal:** The Competition, Exam, and TP create forms feel long and overwhelming.
Make them feel short and focused by hiding advanced fields behind a toggle.
The most-used fields are immediately visible. Everything else collapses.

**Rules:** UI restructuring of the create form components only.
Do not change field names, validation rules, API payloads, or submit logic.
All fields must still exist in the DOM — just hidden/shown via toggle state.

## Changes

Apply this pattern to all three create flows:
**Competition wizard** (steps 1–5), **Exam create form**, **TP create form**.

### The pattern: "Advanced settings" collapsible

In each form/step, identify which fields are:

**Always visible (core fields):**
- Competition: title, description, start date/time, duration, participation mode (solo/team), scoring mode, attach problems
- Exam: title, start date/time, duration, access mode (module/code/request), attach problems
- TP: title, deadline, access mode, attach tasks

**Advanced (collapsed by default, user can expand):**
- Competition: freeze settings, penalty minutes, team size min/max, per-problem decay/penalty values, visibility details
- Exam: passing score, penalty toggle + penalty settings, question randomization toggle
- TP: max attempts, per-attempt duration, late submission settings

### Implementation

At the bottom of each form section (or each wizard step for Competition), add:

```
[chevron-down icon]  Advanced settings
```

Styled as: `color: var(--ink-3)`, `font-size: 13px`, `font-weight: 600`, `cursor: pointer`.
No border, no background — just the text + icon. On click: icon rotates 180°, advanced fields slide into view.

Use a simple boolean state toggle — no animation library needed. If you want a smooth reveal:
```css
.advanced-fields {
  overflow: hidden;
  max-height: 0;
  transition: max-height 200ms ease;
}
.advanced-fields.open {
  max-height: 600px;
}
```

**Important:** If a teacher previously saved a draft with advanced fields filled in, open the advanced section automatically when they return to edit — detect this by checking if any advanced field has a non-default value on mount.

### Verify
Open Competition create (all 5 steps), Exam create, TP create.
Each form shows only core fields immediately. "Advanced settings" toggle is visible.
Clicking it reveals the advanced fields. All fields still submit correctly with the same payload.
`tsc --noEmit` clean.

---

---

# PROMPT 4 — Empty states: instructional, not generic

**Goal:** Every empty state on the platform should tell the user what to do next,
not just that nothing is there. This is the difference between a finished product
and a prototype. One line of context per empty state eliminates the "broken" feeling.

**Rules:** Text and icon changes only in empty state components.
Do not restructure layouts or change any logic.

## Find and update every empty state

Search the codebase for empty state components/patterns.
Look for: "No X found", "No X yet", "Nothing here", generic empty illustrations,
or any conditional render that shows a message when a list/array is empty.

Replace each one with the instructional version below.
Match the correct context — use the page/component name to identify which message to use.

### Teacher side

| Location | Current (likely) | Replace with |
|---|---|---|
| Competition problems tab (0 problems) | "No problems added yet" | "No problems attached — add from your problem bank to make this contest submittable." |
| Exam problems tab (0 problems) | "No problems added yet" | "Attach problems to this exam. Students won't be able to start until at least one is added." |
| TP tasks tab (0 tasks) | "No tasks added yet" | "Add tasks from your problem bank. Each task can have its own point value and attempt limit." |
| Submissions tab (empty) | "No submissions yet" | "No submissions yet. They'll appear here in real time once the event is active." |
| Requests tab (empty) | "No requests" | "No join requests. Requests appear here when visibility is set to Request-based." |
| Teacher dashboard active events (empty) | "No active events" | "Nothing active right now. Create a competition, exam, or TP to get started." |
| Competition scoreboard (no teams) | "No teams registered" | "No teams yet. Share the competition link so students can register." |

### Student side

| Location | Replace with |
|---|---|
| Dashboard — no active events | "Nothing active right now — check Competitions and Exams for upcoming events." |
| Dashboard — no recent activity | "No submissions yet. Head to Practice to solve your first problem." |
| Problems list (filtered, 0 results) | "No problems match your filters. Try adjusting the difficulty or status." |
| Assessments list (empty) | "No exams or TPs assigned yet. Your teacher will share an access code when one is ready." |
| Competition list (empty) | "No competitions available right now. Check back soon or ask your teacher." |
| Leaderboard (empty) | "No rankings yet — solve practice problems to earn points and appear here." |

### Shared pattern for all empty states

Each empty state should render as:
```
[lucide icon, 28px, color: var(--ink-3)]
[Title line, font-weight: 650, color: var(--ink), margin-top: 12px]
[Subtitle line, font-size: 13px, color: var(--ink-2), margin-top: 4px]
[Optional: a single action button if there's a clear next step]
```
Centered in its container. No large illustrations. No heavy padding (32px top/bottom is enough).
The icon should relate to the content type: trophy for competitions, doc for exams, flask for TPs, code for problems.

### Verify
Visit each page listed above with empty data (use test accounts or temporarily empty filters).
Confirm each empty state shows the correct instructional message.
No visual regressions. `tsc --noEmit` clean.

---

---

# PROMPT 5 — Mobile responsiveness for the arena

**Goal:** The competition arena (problems rail + statement + editor) must be usable on mobile.
University students use phones. If the arena breaks on mobile, a large portion of users can't compete.

**Rules:** CSS/layout changes only. Do not change WebSocket logic, submission handlers, or scoring.
Target: screens 390px–768px wide (iPhone-class). Tablet (768px–1024px) as a bonus.

## Changes

### 5a. Arena layout collapse

The arena uses a 3-column grid: `[problems rail 240px] [statement 1fr] [submit panel 420px]`.
On mobile this must become a **single-column tabbed layout.**

Add a mobile tab bar fixed to the bottom of the screen (below the event bar) with 3 tabs:
`Problems · Statement · Submit`
Each tab shows/hides the corresponding column. Default active tab: Statement.

```css
@media (max-width: 768px) {
  .arena-grid {
    display: block; /* or grid-template-columns: 1fr */
  }
  .arena-rail,
  .arena-statement,
  .arena-submit {
    display: none;
  }
  .arena-rail.mobile-active,
  .arena-statement.mobile-active,
  .arena-submit.mobile-active {
    display: block;
  }
}
```

The mobile tab bar:
```
position: fixed; bottom: 0; left: 0; right: 0;
background: var(--surface); border-top: 1px solid var(--line);
display: flex; height: 52px;
```
Each tab: equal width, centered icon + label (12px), active = `color: var(--accent-2)` with a 2px top border in `--accent`.

### 5b. Event bar on mobile

The event bar (contest title, timer, team chip, tabs) is too wide for mobile.
On mobile:
- Hide the section tabs (Problems / Submissions / Scoreboard / Team) — these move to the bottom tab bar above
- Keep: logo/title (truncated to 1 line), timer, and profile avatar only
- Timer should remain visible at all times — it's critical information

```css
@media (max-width: 768px) {
  .event-bar-tabs { display: none; }
  .event-bar-title { 
    max-width: 180px; 
    overflow: hidden; 
    text-overflow: ellipsis; 
    white-space: nowrap; 
  }
}
```

### 5c. Problems rail on mobile

When the "Problems" tab is active on mobile:
- Show the full problems list (A/B/C/D… with status dots and points)
- Each row is tall enough to tap: minimum `44px` height
- Tapping a problem switches to the Statement tab and loads that problem

### 5d. Submit panel on mobile

When the "Submit" tab is active on mobile:
- The code editor takes the full screen height minus the event bar and tab bar
- Language picker stays at the top
- The test case runner and Submit button are fixed at the bottom (above the tab bar)
- The editor itself should be scrollable

```css
@media (max-width: 768px) {
  .arena-submit {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 62px - 52px); /* event bar + tab bar */
  }
  .code-editor {
    flex: 1;
    overflow: auto;
  }
  .submit-footer {
    flex: none;
    padding: 10px 14px;
    border-top: 1px solid var(--line);
    background: var(--surface);
  }
}
```

### 5e. Non-arena pages on mobile

For all other pages (browse, lists, manage pages):
- Navigation: collapse the navbar links into a hamburger menu or a bottom tab bar (same fixed pattern as the arena, with the 5 main nav items)
- Stat tiles: `grid-template-columns: 1fr 1fr` on mobile (2×2 grid instead of 4 in a row)
- Event list rows: stack the meta line below the title (flex-direction: column on the `.em` inner div), hide the right-side buttons behind a "···" menu or show only the primary action button
- Problem table: hide the Category column on mobile (`display: none` on that `td` and `th`), keep Problem / Difficulty / Actions visible

### Verify
Open the arena on a mobile-sized browser window (DevTools → 390px wide).
Confirm: bottom tab bar visible, all three panels switchable, timer always visible, editor scrollable, Submit button reachable.
Open the browse pages at 390px: navbar collapsed, stat tiles in 2×2 grid, list rows readable.
`tsc --noEmit` clean. Desktop layout completely unchanged.

---

## Running order

1. Prompt 1 first — affects every page, sets the foundation
2. Prompt 2 — student dashboard only
3. Prompt 3 — create forms only
4. Prompt 4 — empty states, text-only changes
5. Prompt 5 — mobile, CSS-only

Each prompt is independent after Prompt 1. If one fails or partially applies,
the others are unaffected. Send screenshots after each one.
