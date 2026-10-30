# Implementation status (2026-10-30)

**Verification honesty:** unit tests (24 pass), `tsc` clean for `src/` and `tests/`, ESLint clean on new code, and a webpack build of the working tree (with the pre-existing type-validation error bypassed) compiles and prerenders every new route. **The UI was NOT exercised in a browser**: the local dev server requires sign-in, no local admin credential exists in `.env.local`, and I declined to forge a session. Treat interactions (drag/drop, palette, dialogs, responsive layouts, themes) as unverified until you sign in and click through. Nothing is deployed or committed.

## Built
| Area | State |
|---|---|
| Docs: audit, design research (knowledge-based, no live inspection), architecture | done |
| Shell: collapsible sidebar (persisted), tooltips, mobile drawer, header with date/search/quick-create/notifications/sync status/theme/profile | built, unverified visually |
| Design system “Graphite” (dark + light), `styles/cc.css` | built |
| Command palette (⌘/Ctrl+K, fuzzy, recents, create intents, ↑↓/Enter/Esc, ⌘↵ launch) | built |
| Quick capture (task/shoot/idea/note/reminder, NL date parsing) + `C`, `G`+key shortcuts | built |
| Home: stats, Focus Now, My Day, Production, Activity, Schedule, Inbox, Pulse, Quick apps; hide/show/reorder persisted | built |
| My Day / Tasks: deadline ≠ planned time, durations, recurrence, 8 views, inline edit, bulk, drag to day, Plan-my-day (explicit reschedule), undo, J/K/X keys, history | built |
| To Shoot: Board (drag), List (sort), Calendar, Timeline, record panel, checklist, references/assets with image/video preview, link to sheet deliverable, configurable stages, brief generation | built |
| Application Library: 35 apps seeded from ClaudeHQ registry, add form, favorites, recents, filters, health, embed only when headers allow | built |
| App health page + server checker | built |
| Gmail (read-only list/thread/search, email→Gemini→tasks with consent) | code complete, **needs credentials/scope** |
| Calendar (read-only, IST) | code complete, **needs `calendar.readonly`** |
| Gemini (briefing, ask, email actions, brief) with consent, redaction, usage count | code complete, **needs key** |
| Operations (awaiting payment, go-lives, slipped) from the sheet | built |
| Persistence: localStorage + Redis/dev-file sync | built |

## Not built / deviations
- Vercel API deployment history (health is HTTP-probe only).
- In-app Google OAuth connect/disconnect with encrypted refresh-token storage; env-based token instead.
- Revenue charts and payment amounts/overdue: the sheet has no amount or due-date fields, so deliberately omitted.
- Notifications are derived in-app (overdue, shoots ≤2 days, publish deadlines, sync errors); no push/email dispatch, no dedupe store.
- Legacy todos shown read-only; legacy deliverables/projects/scripts/settings still use the old shell (no link back to Command Center from them).
- Clients, Reports, Insights, Activity pages from the spec sidebar omitted (“only show modules that have a destination”).
- Task/shoot Supabase tables and migrations: none added (repo has no live Supabase schema; Redis blob state used, whole-document last-write-wins).
- Server routes accept any signed-in user; per-record access control is not implemented.
- Light theme and tablet/mobile layouts written but not visually reviewed; no end-to-end/browser tests.
- The Part 22 design review could not be completed without a browser session.


## Update 2026-10-30: redesign and internal app workspace

Built and verified (dev server):
- Design system v2 and light-first theme, redesigned shell, library and Home (see `UI_AUDIT.md`).
- Internal app workspace `/workspace/apps/[appSlug]` with a registry-driven adapter (`src/cc/apps/adapter.ts`): `native`, `embedded`, `integrated`. Apps never open externally; blocked or unavailable apps show an internal status page with requirements.
- Embedding matrix for all 35 registered apps: `APP_EMBEDDING_MATRIX.md`. Six live apps embed; two portfolio sites block framing; local tools embed only when RM Studio runs locally; the rest have no web surface or no URL.
- Fixed a registry-loading race (`useAppRegistry`) that left a second consumer stuck loading.

Not done / limits:
- No other repository was modified and nothing was deployed. Adding an exact-origin `frame-ancestors` policy to owned apps is recommended but pending.
- Third-party-cookie behaviour for framed logins is untested (Safari/Brave likely affected).
- Pages not yet in the CC shell (`/deliverables`, `/projects`, `/scripts`, `/settings`) are not framed.
- Native modules for apps without a web UI (notes, ledger, etc.) are not built; they show what is required.
- Dark theme, drag-and-drop, Calendar/Timeline and full-size desktop screenshots were not visually reviewed.
- Nothing is committed.


## Update 2026-10-30 (evening): unified application workspace

Verified by `npm run test:e2e` — 33/33 passing on localhost, signed in:
- 15 approved applications; 14 render their real interface inside RM Studio at `/workspace/apps/<slug>`. VaultDrop shows an integration status because its Mac-hosted Tailscale URL was not reachable.
- Origin never left RM Studio, no tabs opened, switching/back/forward/refresh/⌘K all stay internal.
- Original RM Studio pages (Deliverables, Scripts, Settings) run inside the shell at `/studio/...`; opening an old URL directly lands in the shell. The old `/projects` route already redirected to Scripts, so Projects was removed from the nav.
- Library shows only approved apps (no portfolios); excluded projects are listed with reasons in the Integration status tab and `APP_ONLY_INVENTORY.md`.

Not done / not verified:
- Signing in to BillVault, Ledger, Product Ledger, Leave Tracker, Leave & Overtime inside the frame (their login screens render; no test credentials for production). Safari/Brave third-party-cookie behaviour untested.
- Shared sign-on across apps (needs one auth provider or one registrable domain).
- Frame-ancestors hardening in each app repo (recommended, not required for embedding; needs redeploys).
- The Command Center is not deployed. Production also needs the pre-existing `authOptions` build fix.
- Original RM Studio Scripts page shows “Supabase not configured” locally (missing local env), not a hosting issue.
- Nothing committed.
