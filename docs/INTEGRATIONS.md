# Integrations

| Integration | Mechanism | Scope | Status |
|---|---|---|---|
| Gmail | Existing `GMAIL_*` refresh token → `/api/cc/gmail` | read-only | Code complete. Needs token with `gmail.readonly` (current token's scope unverified) |
| Google Calendar | Same token → `/api/cc/calendar` | read-only | Code complete. Needs `calendar.readonly` added to the token |
| Gemini | `@google/genai` → `/api/cc/ai` | n/a | Code complete. Needs `GEMINI_API_KEY` |
| Cloud state | Upstash Redis via `/api/cc/state/[key]` | n/a | Needs `UPSTASH_REDIS_REST_*` (already in prod) |
| Deliverables | `/api/deliverables` (Google Sheet) | read-only | Working (existing) |
| App health | `/api/cc/health` server probes | n/a | Working |
| Vercel API (deployments) | — | — | **Not built.** Health uses HTTP probes only |

## Behaviour contracts
- A missing credential returns `conn: "not_configured"`; a 401/403 from Google returns `conn: "scope_missing"`. The UI shows a banner with the reason; no sample data is ever substituted.
- Gmail never sends, replies, archives or deletes. Thread bodies are fetched on demand, truncated to 6 000 chars, returned to the viewer and not stored. Only `threadId` is saved on tasks created from email.
- Calendar events are never created or edited.
- No OAuth tokens are stored in the browser. Tokens are env-based on the server; there is no in-app OAuth connect flow yet (see status).
