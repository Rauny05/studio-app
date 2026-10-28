# RM Studio — native iOS

SwiftUI, iOS 18+, iPhone + iPad (tab bar → sidebar on iPad). See [PROGRESS.md](PROGRESS.md) for the audit, decisions and honest verification status.

```
ios/
  project.yml                  XcodeGen spec → RMStudio.xcodeproj
  Packages/RMStudioKit/        Foundation-only domain layer (models, API client, sync, offline queue, logic) + XCTest suite
  RMStudio/                    SwiftUI app (Core/, Design/, Features/, Assets.xcassets)
  RMStudioUITests/             UI smoke test
```

## What's in the app

- **Home**: attention list (late / today / soon go-lives, delivered-but-unpaid, scripts awaiting approval), today's go-lives with one-tap completion, open tasks, studio overview — all computed from live data. Quick-action menu, ⌘K search.
- **Production**: sheet deliverables (search, status filter, swipe/context-menu completion, payment stage toggles, activity log) and production boards (stages, move card with undo).
- **Completion**: persists status + timestamp + live URL + activity entries through the same endpoint the web uses (so the Activepieces automation fires), and builds a **reviewable CFO email draft** (Open in Mail / Share / Copy). Nothing is sent automatically.
- **Scripts**: library of production-card scripts (search title+body, sort, filter, word count), native editor with autosave (device first, then server), draft recovery, undo/redo, find, templates, duplicate, rename, Markdown export, offline editing and conflict resolution. **Inbox** tab for emailed Google-Doc scripts with admin approval.
- **Finance**: client payment pipeline (counts by stage — the backend has no amounts) and the ₹ cash book (add/delete, month totals).
- **More**: tasks, derived contacts (call/email), settings (sync status, notification prefs, sign-out).
- **Offline**: every write is a durable op replayed with optimistic concurrency; UI shows "saved on device / syncing / synced" and only says synced after the server confirmed.
- **Deep links**: `rmstudio://deliverable/<id>`, `card/<id>`, `script/<id>`, `board/<id>`, `inbox/<id>`, `contact/<id>`, `payments`, `tasks`.

## Open in Xcode (macOS, Xcode 16+)

```bash
brew install xcodegen
```

```bash
cd ios && xcodegen generate && open RMStudio.xcodeproj
```

Pick an iPhone/iPad simulator and Run. Unit tests (no Xcode project needed):

```bash
cd ios/Packages/RMStudioKit && swift test
```

The app talks to `https://rmmedia-studio.vercel.app` (`RMStudioBaseURL` in `project.yml`). **Deploy the backend changes in this branch first** — scripts/reminders endpoints and the `X-Base-Updated-At` check are required for the app's Scripts inbox and conflict-safe writes.

Sign-in: Google (must be on the allow-list) or the access code (`APP_ACCESS_CODE` on Vercel).

## Run on your own iPhone

1. Xcode → target **RMStudio** → Signing & Capabilities → select your Apple ID team; change the bundle id if `com.rmmedia.studio.ios` is taken.
2. iPhone: Settings → Privacy & Security → Developer Mode on. Connect, select the device, Run.
3. Free Apple ID: app expires after 7 days and **Push Notifications capability is unavailable** (local reminders still work). Paid Developer Program ($99/yr): TestFlight / App Store distribution via Product → Archive.

## Push notifications (needs your credentials)

1. Developer Program → Keys → create an **APNs key (.p8)**; note Key ID and Team ID.
2. Xcode → add the **Push Notifications** capability (adds `aps-environment`).
3. Backend: the app already registers its token with `POST /api/push/apns` (stored in Redis key `studio:apns-tokens`). A sender (HTTP/2 to `api.push.apple.com` using the .p8) still has to be added next to `src/app/api/push/golive-reminders/route.ts`; put `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID` in Vercel env.

## Backend env the app depends on

`APP_ACCESS_CODE`, `NEXTAUTH_SECRET` (must be set — shared JWT secret), `GOOGLE_CLIENT_ID/SECRET`, `UPSTASH_REDIS_REST_URL/TOKEN`; the deliverables sheet must stay link-viewable.
