# Ecosystem Audit

Audited 2026-10-30 from `~/Downloads/Claude` (the production RM Studio repo). No secret values are recorded here — only variable names.

## 1. Current repository

- Branch `main`, remote `Rauny05/studio-app`. Seven files carry pre-existing uncommitted changes (`.claude/*`, `package*.json`, `speedtest/index.html`, `ScriptsBoard.tsx`, `styles/global.css`). They were **not** touched except `package.json`/lock (additive dependencies only).
- Extra branches/worktrees exist under `.claude/worktrees/*`. Left alone.
- Stack: Next.js 16.1.7 (App Router), React 19.2, TypeScript 5.9, Tailwind 4, Zustand 5, NextAuth 4 (Google + admin passcode, JWT), `@upstash/redis` (REST via `src/lib/data-store.ts`), Google Sheets as deliverables source of truth, Capacitor Android wrapper, Remotion.
- `docs/` did not exist. `RM_STUDIO_ANALYSIS.md` (June) is **stale**: it describes Supabase/Prisma/NextAuth v5 which are not what the code now runs. Supabase has only one untracked helper (`src/lib/supabase.ts`) and no schema in this repo.

## 2. Existing routes (preserved)

Protected by `src/middleware.ts` (permission keys per route): `/dashboard`, `/projects` (+`/[boardId]`), `/deliverables`, `/calendar`, `/todos`, `/scripts`, `/settings`, `/admin`; public-ish: `/cash`, `/auth/*`.

API: `deliverables` (+`sync`), `gmail/{poll,poll-trigger,scan,webhook}`, `push/*`, `reminders`, `scripts`, `sync/[key]`, `vault/*`, `mobile/*`, `lambda/*`, `admin/users`.

## 3. Data ownership today

| Entity | Source of truth | Access |
|---|---|---|
| Deliverables, brand, POC, go-live, payment fields | Google Sheet (`/api/deliverables`, write-back via `sheets-write.ts`) | server |
| Kanban boards/cards ("Projects") | Zustand `studio-kanban` persisted locally, cloud-synced to Redis `studio:sync:kanban` | client + Redis |
| Todos (flashcards) | Zustand `studio-todos-v1`, Redis `studio:sync:todos` | client + Redis |
| Reels | `reels-store`, Redis `studio:sync:reels` | client + Redis |
| Scripts | Redis (`scripts-store`) fed by Gmail "scripts to check" poll | server |
| Allowed users / roles | Redis `studio:allowed-users`, fallback `data/allowed-users.json` | server |
| Push subscriptions, reminders | Redis | server |

## 4. Environment variable names present

`GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET/URL`, `VAPID_*`, `UPSTASH_REDIS_REST_URL/TOKEN`, `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_SHEETS_SERVICE_ACCOUNT`, `APPS_SCRIPT_URL`, `ADMIN_ACCESS_CODE`, `APP_ACCESS_CODE`, `CRON_SECRET`, `POLL_SECRET`, `NTFY_TOPIC`, `FIREBASE_SERVICE_ACCOUNT`, `AWS_*`/`REMOTION_AWS_*`, `NEXT_PUBLIC_SUPABASE_*`.
Local `.env.local` currently defines only the Google/NextAuth/VAPID subset; Redis, Gmail refresh token and Gemini are **not** set locally.
New names introduced by Command Center: `GEMINI_API_KEY`, `GEMINI_MODEL`, `CC_TOKEN_ENC_KEY` (reserved for encrypted OAuth tokens).

## 5. Application inventory

Source: `~/Downloads/ClaudeHQ/agent/registry.json` (exists, 35 projects, updated 2026-10-19), seeded into `data/app-registry.json`. Not assumed complete: the registry is user-editable in the Application Library and `Add application` persists extras.

Classification (A native, B API, C secure embed, D external launch, E investigate):

| Class | Apps |
|---|---|
| A Native | RM Studio (deliverables, scripts, projects, calendar, todos) |
| B API | Email Digest (Gmail read-only, no HTTP surface here), Gmail/Calendar via Google APIs |
| C Embed | BillVault, SwiftDrop, Broadcast, Expense CC — live, **no** `X-Frame-Options` / CSP seen on 2026-10-30. Re-verified at runtime by `/api/cc/health` (header probe); embed is only offered when the probe passes. |
| D External | Sakshi V1/V2 portfolios (`X-Frame-Options: DENY`), all `localhost`-only tools (ScriptFlow :3030, R.Clipper :4001, OTP Mock :5173, Remotion :3000), native/mobile apps (Android, Flutter, Expo), CLI/utility projects |
| E Investigate | DeskBoard, Leave Tracker, RM Studio prod (HTTP 307 to a login — embed policy unknown behind auth), apps without a deploy URL |

Protected/dirty projects (Ledger, ScriptFlow, Batta, Singh, Notes, VaultDrop…) are only **read** as registry rows. Nothing in their directories is modified. `rm-studio-mirror` (`studio-app`, different remote) is listed and flagged *unverified*.

## 6. Monitoring endpoints

None of the apps expose `/health`. Checker therefore does a server-side `GET /` (HEAD fallback) with timeout, treats 2xx/3xx/401/403 as *reachable*, 5xx as *degraded*, network failure as *offline*, no URL as *not configured*, and `localhost` URLs as *unknown* when probed from Vercel.

## 7. Risks

- Redis/Gmail/Gemini unconfigured locally → features degrade explicitly, never fake.
- Existing Gmail refresh token scope is unknown; Calendar needs `calendar.readonly`. See `INTEGRATIONS.md`.
- Two shells coexist (legacy `AppShell`, new Command Center shell) until legacy pages are migrated.
