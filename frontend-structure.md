# Frontend `src/` Structure (2 levels deep)

## `app/` — pages (Next.js App Router)
```
app/
├── admin/
├── arena/
├── assessments/
├── auth/
├── competitions/
├── (ctf)/          ← route group
├── ctf/
├── dashboard/
├── leaderboard/
├── problems/
└── teacher/
```

## `components/`
```
components/
├── arena/
├── ctf/
├── manage/
├── problem/
├── problems/
└── ui/
```

## `hooks/`
```
hooks/            ← flat, no subfolders (e.g. useCountdown, useAntiCheat, useFullscreen)
```

## `lib/` — also the services/api layer
```
lib/              ← flat, no subfolders (api.ts = API client + all endpoint calls)
```
- No separate `services/` or `api/` folder.
- No `utils/` folder — `lib/` serves both roles (`lib/api.ts`, `lib/brand.ts`, `lib/logger.ts`, etc.).

## `features/` — feature-sliced modules (bulk of the app)
```
features/
├── admin/
├── arena/
├── auth/
├── competitions/
├── ctf/
├── landing/
├── leaderboard/
├── student/
└── teacher/
```

## `contexts/`
```
contexts/         ← React context providers (flat)
```

**Notes:**
- Most page logic lives under `features/*/pages/` (e.g. `features/student/pages/Dashboard.tsx`); `app/*` mostly holds thin route entry points that import from `features/`.
- `features/*` and `components/*` have deeper levels (`pages/`, `components/`, `hooks/`, etc.) not shown at this depth.
