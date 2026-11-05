# UI audit

Redesign pass of 2026-10-30. "Before" is the Graphite v1 interface shipped earlier in this project; findings come from reading its code and using it, not from screenshots (see Testing limits).

## Problems found in v1

| Area | Finding | Cause |
|---|---|---|
| Overall look | Dark-only, generic dashboard feel | One theme, lime used as a text/fill colour everywhere, heavy panel borders |
| Home | Five large stat cards, a gradient "Focus now" card, six isolated panels | `.cc-stats`, `.cc-focus` with gradient, widget order not tied to a daily workflow |
| Header | Page title plus long date on every page | `.cc-crumb` showed `h1` + date; no breadcrumbs |
| App launch | Every app opened an external tab | `openApp()` in `Apps.tsx` called `window.open`; palette had the same; Home "Quick apps" used `target="_blank"` |
| Library | Flat list with a side panel that embedded a 420px iframe | No launcher structure, no workspace route |
| Consistency | Panels, rows and tabs each used one-off spacing | No shared table/row primitive |

External-launch call sites removed: `Apps.tsx` (`openApp`, "Open in new tab", inline iframe), `Palette.tsx` (`alt` handler), `Home.tsx` (Quick apps). Remaining `target="_blank"` uses are links to Gmail threads and user-supplied reference/asset URLs in To Shoot; those are content links, not application launches.

## What changed

- **Design system v2** (`styles/cc.css`): warm paper surfaces, ink text, 1px hairlines, 5–8px radii, no shadows except overlays, no gradients. Ink-filled primary buttons; lime only marks selection, focus and the checkbox. Light theme is default (existing local prefs are migrated once); dark theme redesigned separately with its own tokens. Geist and Geist Mono via `next/font`.
- **Shell**: 44px header with breadcrumbs, search, quick create, notifications, sync, theme; sidebar gains Pinned and Recent apps; app workspaces put the app icon, name, mode, health, reload, fullscreen and a switcher in the header.
- **Shared primitives**: `.cc-tbl/.cc-row` (data rows), `.cc-toolbar`, `.cc-searchfield`, `.cc-rail`, `.cc-mode`, `.cc-callout`, `.cc-facts`, `AppIcon`. Library, Home and the status page all use them.
- **App library**: filter rail (views and categories with counts), searchable dense table, favourites, recents, health dot, "Opens as" column, whole row opens the workspace.
- **Home**: removed stat cards and the gradient card. Order is My Day, Upcoming (7 days: calendar, shoots, publish and task deadlines), To Shoot table with readiness, then Important email, Studio operations, Pinned apps, Recent activity. Every number comes from connected data.
- **Workspace**: `/workspace/apps/[appSlug]` with the adapter described in `APP_EMBEDDING_MATRIX.md`.
- Tasks, To Shoot, Inbox, Calendar, Operations, Settings pages pick up the new tokens and primitives through the shared stylesheet; their markup and behaviour were not rewritten.

## Not redone

To Shoot and Tasks were restyled, not re-architected: they keep their existing Board / List / Calendar / Timeline views and detail panel (script, brief, checklist, linked deliverable, prep-task creation). A separate "related tasks" list, call-sheet style layout and a per-record attachments gallery redesign were not done.

## Testing

Run on the dev server (Next.js, localhost:3000), signed in with the admin passcode.

| Check | Result |
|---|---|
| Unit tests | 32 pass (`npm test`), including 8 new adapter tests |
| Typecheck / lint of Command Center code | clean (1 pre-existing `<img>` warning) |
| Horizontal overflow at 1440, 1920, 820 | none on Home, Tasks, To Shoot, Apps, workspace |
| Mobile 375 | real screenshots of Home, Apps, To Shoot and a status page reviewed; fixes applied for the hidden "Opens as" column and chips |
| Internal navigation | library → app, sidebar → library, back/forward all stayed in one document; zero `window.open` calls |
| iframe rendering | BillVault, DeskBoard, SwiftDrop, local R.Clipper rendered at full content size; loading overlay clears on load |
| Blocked embed | Sakshi V2 shows the status page with requirements |
| Themes | Light verified by screenshot (mobile) and computed styles; **dark theme not visually reviewed** |

### Testing limits (stated plainly)

- The browser pane returns screenshots no wider than ~333px. Desktop and tablet were verified by DOM metrics (overflow, element sizes, grid columns), not by looking at full-size screenshots. A human pass at 1440/1920 is still needed for visual polish.
- Playwright was not used: every page requires sign-in and credentials were not scripted.
- Drag-and-drop (board, task planning), Calendar/Timeline views and the dark theme were not exercised after the redesign.
- Authenticated flows inside embedded apps (BillVault access code, Leave Tracker login) were not tested; see third-party cookie note in the matrix.
- A pre-existing service worker (`rm-pages-v2`, `rm-static-v2`) served stale CSS/JS to the dev origin until unregistered; if styles look old locally, unregister it in DevTools → Application.


## v3 revamp (2026-10-30, same day)

Feedback: the v2 Home still looked cluttered. Reviewed at real 1440/1920/820/390 widths with a headless Chromium using a signed-in profile.

- **Home is an editorial daily brief, not a grid of boxes.** Date, greeting and one data-built summary sentence, then unboxed sections (Today, This week, To Shoot) in the main column and a quiet rail (Email, Studio figures, Pinned/Recent apps, Activity). Sections are separated by whitespace and a single hairline under each heading.
- **No warning banners on Home.** "Gmail / Calendar not connected" is a one-line muted link in the section header.
- **Sidebar**: workspace menu (theme, sync status, collapse, classic RM Studio, sign out), search field with ⌘K, unlabeled core nav, Studio group, Apps group (pinned, else recent), system links as footer icons. Selection is a neutral fill; lime is now limited to checkboxes, focus and the "now" marker.
- **Header**: page title, New, notifications. Search, theme, sync and avatar moved out.
- **Global CSS bug fixed**: the `.cc-root a/button/input` resets outranked component classes, which stripped button borders and padding (tab bars ran together, outline buttons had no outline) and forced link colours to near-black. Resets are now `:where(...)` (zero specificity).
- **Sign-in** returns to the requested page (default `/home`) instead of always `/dashboard`; only same-origin paths are accepted.

### Workspace pages (Tasks / My Day, To Shoot, Inbox)

- One shared layout (`.cc-view`): a 46px toolbar with underline tabs, filter and the page's primary action; full-bleed content; a docked right detail panel that exists only while something is selected (full-screen sheet on mobile). Page titles are no longer repeated under the header.
- Boxes removed: groups are soft bands, rows are hairline-separated, Panels inside views render as plain sections.
- Detail panels are property lists (label left, borderless value with hover/focus field, "Empty" placeholders) instead of stacks of bordered inputs.
- Tasks: inline add row, bulk bar appears only with a selection (ink bar), bulk checkboxes appear on hover, legacy todos are a read-only group at the end of the list, the "Select a task" placeholder card is gone.
- To Shoot: stage dots on board columns, empty columns are short dashed drop zones, list view is a full-width table with sticky-looking header band.
- Inbox: Superhuman-style single-line rows (unread dot, sender, subject — snippet, date). The duplicate "not connected" banner is shown only for scope or token errors; otherwise the empty state explains it.
- Verified by full-size screenshots at 1440 (light and dark), 820 and 390, including open detail panels. Not exercised: Calendar/Timeline views after restyle, drag-and-drop, an Inbox with real threads (Gmail not connected).
