# RM Studio iOS — progress & audit

Resume point for future sessions. Last updated 2026-10-28.

## Audit (what actually exists)

The brief assumed two apps on Supabase. The repo says otherwise:

| Brief assumed | Reality |
|---|---|
| Supabase, RLS, SQL schema | **None.** Next.js 16 on Vercel; data lives in **Upstash Redis JSON blobs** (`studio:sync:<key>`, `studio:scripts`, `studio:reminders`) plus a **public Google Sheet** (CSV export) for client deliverables |
| Separate "RM Scripts" app with editor, folders, versions, AI | **No such project on this machine or in the repo.** `/scripts` is an *inbox*: Gmail poll ingests emailed Google-Doc links, admins approve per doc. Script *text* lives in Kanban card `description` (web "Production" boards) |
| Contacts module | No table. Only `poc`/`pocName`/`pocCompany` strings on deliverable rows |
| Payments with amounts, due dates | Sheet stores 3 booleans per project (invoice email sent / 50% advance / 100% paid) + invoice number. **No amounts, currency or due dates.** Separately a personal "Cash book" (income/expense, ₹) syncs under key `cash` |
| Server search | None |
| APNs | Web Push (VAPID), ntfy and FCM (Android) only. No APNs sender |
| Mobile auth | Already exists: `POST /api/mobile/auth` (access code) and `/api/mobile/oauth/*` (Google → `rmstudio://auth?token=`), 90-day HS256 JWT; `/api/deliverables` and `/api/sync/[key]` already accept it |

Sync keys (whitelist): `kanban, todos, reels, priority-videos, cash, deliverable-overrides, deliverable-local-rows, deliverable-hidden`. Writes are whole-blob, last-write-wins.

Completion automation: web writes the full `deliverable-overrides` map to `/api/sync/deliverable-overrides`; the server diffs and fires the Activepieces webhook for newly completed items. iOS uses the same endpoint, so the automation runs identically. `src/lib/sheets-write.ts` (sheet write-back) exists but is **not called anywhere** — dormant, not touched.

## Decisions

- Native app is a **new `ios/` folder** in this repo (the repo already holds `android/`). Web code untouched except small, backward-compatible API changes below.
- **Backend stays the source of truth**; no new database. Scripts = production cards' `description`; Inbox = `/api/scripts`.
- **Generic ops, not whole-blob writes.** The app records intents (`PendingOp`), applies them optimistically, persists them, then replays them against the *latest* server blob using `X-Base-Updated-At` optimistic concurrency (409 → re-read, re-apply, max 3). Unknown JSON fields are preserved (`JSONValue`), so web-added fields survive iOS writes.
- Script edit conflicts: op carries the text it was based on; if the server text differs, nothing is overwritten and the user picks mine/theirs.
- Persistence: JSON files in Application Support (`DiskStore`; excluded from backup, `completeFileUnlessOpen`) instead of SwiftData — simpler to keep byte-compatible with the web blobs. Token in Keychain.

## Backend changes (all backward compatible)

- `src/lib/api-auth.ts` — session **or** mobile Bearer.
- `GET/PATCH/DELETE /api/scripts*`, `/api/reminders*` now accept the mobile token (admin-only rules unchanged).
- `POST /api/sync/[key]` — optional `X-Base-Updated-At` header → 409 `{error:"conflict", current}` when stale. Web doesn't send it, so unchanged for web. Helper + tests: `src/lib/sync-version.ts`, `tests/sync-version.test.ts`.
- `POST/DELETE /api/push/apns` — stores APNs device tokens in `studio:apns-tokens`. **Sending is not implemented** (needs Apple key).

## Verification status (be precise)

| Check | Result |
|---|---|
| Web: `npx tsc --noEmit`, eslint on changed files, `npm test` | pass (7/7) |
| Swift syntax (tree-sitter-swift) on all non-test files | parses clean |
| Swift **compile**, unit tests, UI tests, simulator run | **NOT RUN** — this session is Linux, no Swift/Xcode (download.swift.org blocked). CI workflow `.github/workflows/ios.yml` will do it on a macOS runner |
| Against live backend | **NOT RUN** (no credentials in session) |

Treat the Swift as *written and reviewed, not compiled*. Expect to fix a few compile errors on first build.

## Not done / not possible with current backend

- Script ↔ deliverable linking: no field exists. Scripts link to a production board/stage only. Needs a schema addition in the web app.
- Script version history, folders/tags beyond board+type, AI writing tools: nothing in backend to port.
- Contacts creation, payment amounts/overdue dates, server-side search: backend lacks them (derived/in-memory only).
- APNs delivery (server), background refresh. Local reminders (go-live 18:00 eve + 09:00 day; payment follow-up 10:00) are implemented but only as fresh as the last sync.
- Per-key permission checks on `/api/sync` (any signed-in user can read/write every key) — pre-existing.
- UI tests: one smoke test only. No performance measurements taken.

## Security notes found in the existing backend (not changed)

1. `/api/mobile/auth`: a correct `APP_ACCESS_CODE` with an **unknown email returns an admin token**.
2. `NEXTAUTH_SECRET` falls back to `"fallback-secret-change-me"` in `mobile-auth.ts` / mobile routes if unset.
3. `GET /api/push/register` returns every user's push token with **no auth**.
4. Mobile JWTs are valid 90 days, never re-checked against the allow-list (no revocation); no refresh endpoint.
5. Activepieces webhook URL is hard-coded in `src/lib/activepieces-webhook.ts`.
6. Web `CloudSync` pushes whole stores; an open web tab holding stale state can overwrite an iOS edit made between its polls.
