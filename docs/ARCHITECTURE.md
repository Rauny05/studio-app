# Architecture

## Principles

1. Additive. Legacy routes, stores, CSS and APIs are untouched. New code lives under `src/app/(cc)`, `src/cc`, `src/app/api/cc`, `styles/cc.css`, `data/app-registry.json`.
2. One source of truth per entity; Command Center *references* it.
3. Server-side integrations only; secrets never reach the browser.
4. Every module degrades to an honest "not connected" state.

## Layout

```
src/app/(cc)/layout.tsx        CC shell (sidebar, header, palette, capture, toasts)
src/app/(cc)/{home,my-day,tasks,to-shoot,apps,inbox,agenda,studio-ai,health,integrations}/page.tsx
src/cc/lib/        pure logic (dates, fuzzy, tasks, shoots, health, redact) – unit-tested
src/cc/store/      Zustand persisted stores (tasks, shoots, prefs, apps)
src/cc/components/ shell, palette, primitives (Radix wrappers)
src/app/api/cc/    state/[key], apps, health, gmail, calendar, ai, deliverables proxy
styles/cc.css      tokens + components, scoped under .cc-root
```

Legacy routes appear in the CC sidebar (Deliverables, Projects, Scripts, Calendar, Todos, Settings) and open in the legacy shell. Migrating them into the CC shell is a later, separate step.

## Data ownership

| Entity | Owner | Command Center role |
|---|---|---|
| Deliverables, brand, POC, go-live, payments | Google Sheet via `/api/deliverables` | read-only reference; shoots link by `deliverableId`; Home pulse derives counts |
| Legacy todos | `useTodoStore` | surfaced read-only in Tasks as source `legacy-todo`; not copied |
| CC tasks | `cc-tasks` store → Redis `cc:state:tasks` | owner |
| Shoots (production records) | `cc-shoots` → Redis `cc:state:shoots` | owner of production stage; never duplicates deliverable |
| App registry | seed `data/app-registry.json` + user overlay `cc:state:apps` (add/edit/favorite/recent) | owner of overlay only |
| Dashboard/prefs | `cc-prefs` → `cc:state:prefs`, localStorage mirror | owner |
| Gmail / Calendar | Google | fetched live, bodies not stored; only `threadId` kept on tasks |
| AI usage | `cc:state:ai-usage` counters | owner |

## Persistence

Stores persist to `localStorage` immediately and sync debounced to `/api/cc/state/[key]` (auth-required, zod-validated, size-capped). Server backend = Upstash Redis when env set; otherwise a dev-only file in `.cc-data/` (gitignored); on Vercel without Redis the API returns `501 not_configured` and the client stays local-only (UI shows "Local only" badge). No Supabase migration was needed: the repo has no live Supabase schema.

## Auth

All `/api/cc/*` handlers call `getServerSession(authOptions)`. Middleware matcher extended for new pages. New permission key `command-center` is *not* required: any signed-in user with `dashboard` permission, or admin, may enter (documented trade-off to avoid locking the owner out).

## Integrations (adapters in `src/app/api/cc/*`)

- **Gmail**: reuses the existing refresh-token flow (`GMAIL_*`). Read-only. Returns `{status:'not_configured'}` if absent.
- **Calendar**: same token; requires `calendar.readonly` scope; otherwise `{status:'scope_missing'}`. Timezone `Asia/Kolkata`.
- **Gemini**: `@google/genai`, `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`; configurable). Explicit-context requests only; redaction before send; usage counted.
- **Health**: server-side probe with timeout, in-memory 60s cache, concurrency 6.

## Testing

`npm test` (node strip-types runner) covers date/NL parsing, fuzzy search, recurrence, task bucketing, health classification, redaction, shoot readiness.
