# Handoff to desktop Claude (macOS)

You are picking up a native iOS app built from a Linux cloud session. It has been compiled and smoke-tested only by GitHub Actions (macos-15, Xcode 16.4); it has never been opened in Xcode on a Mac or run against the real backend.

## Do this first
1. Read `ios/PROGRESS.md` (audit, decisions, security notes, honest verification table) and `ios/README.md`.
2. Generate and open the project:
   ```bash
   brew install xcodegen
   ```
   ```bash
   cd ios && xcodegen generate && open RMStudio.xcodeproj
   ```
3. Run unit tests: `cd ios/Packages/RMStudioKit && swift test`.
4. Build and run on an iPhone simulator. Add launch argument `-ui-testing-fixture` (Scheme → Run → Arguments) to load sample data without signing in (DEBUG only; see `RMStudio/Core/Fixtures.swift`).
5. Review every tab visually (Home, Production, Scripts, Finance, More) on iPhone and iPad; fix layout or behaviour problems. UI tour with screenshots: `RMStudioUITests/FixtureTourUITests.swift`.
6. Sign in against the real backend (access code = `APP_ACCESS_CODE` on Vercel, or an allow-listed Google account) and test: deliverable completion + email draft, script edit offline then reconnect, payment toggles, cash entry.

## Prerequisite
The backend changes on this branch must be deployed to Vercel first (scripts/reminders accept the mobile token; `/api/sync/[key]` honours `X-Base-Updated-At`; `/api/push/apns`). Without them the Scripts inbox and conflict-safe saves fail.

## Known gaps (do not claim these work)
- Script ↔ deliverable linking (no backend field), APNs sending (needs Apple key), server-side search, payment amounts/due dates, script version history.
- Signed-in screens have not been exercised against live data.
- Existing backend security issues are listed in PROGRESS.md; not changed.

## Rules
- Keep the web app's behaviour unchanged; API changes must stay backward compatible.
- Never put secrets in the app. Do not add mock data outside `#if DEBUG`.
- Report only what you actually built and ran.
