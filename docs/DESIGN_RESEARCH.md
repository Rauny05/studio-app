# Design Research

**Honesty note.** This was written in a sandbox session. Product interfaces were **not** inspected live or via screenshots; conclusions come from prior knowledge of these products' shipped UX and their public docs. Where a claim would need a live check it is marked *(verify)*. No screen is claimed as examined.

## Reference products → decisions

| Product | Studied (from knowledge) | Adopt | Reject |
|---|---|---|---|
| Linear | Dim sidebar vs focused content, dense list rows, status glyphs, `C` to create, `⌘K`, detail side panel | Dense rows with status glyph + compact metadata; sidebar sections; right-hand detail panel; keyboard-first | Issue-tracker vocabulary; purple brand |
| Raycast | Fuzzy palette, grouped results, recents, action sub-menu (`⌘K` on item) | Palette with groups, recents, create-intents (`task: buy tripod`), action menu | Extension store |
| Akiflow | Today view, deadline ≠ planned time, time blocking, unscheduled inbox | Separate `due` and `plannedDate/Start/Duration`; Plan-my-day mode; explicit reschedule | Calendar-first layout |
| Superhuman | Split inbox, triage, minimal reader | Surface only action-needing threads; deep link to Gmail | Full mail client, archive/reply actions |
| StudioBinder | Shoot calendar, checklists, call sheet info, statuses | To Shoot as production workspace: statuses, prep checklist, location/talent/POC | Call sheet PDF engine |
| Frame.io | Versions, approvals, comments on assets | Approval states and reference/asset links on records | Frame-accurate review engine |
| Vercel | Project list, status dots, last-deploy | App Library rows with health dot, last-checked, filters by state | Build logs |
| Notion / Airtable | One dataset, many views | Shoots: Board / List / Calendar / Timeline from one store | Arbitrary custom schemas |
| shadcn / Radix | Accessible primitives | Radix Dialog, DropdownMenu, Tooltip; custom styling | Importing shadcn wholesale (would duplicate legacy CSS) |
| Mobbin / SaaSUI / Dribbble | Shipped references vs concepts | Mobbin/SaaSUI only for patterns | Dribbble-style decoration |

## RM Studio visual language ("Graphite")

- **Surfaces**: deep graphite `#0e0f11` bg, `#14161a` panels, `#1a1d22` raised; hairline borders `#23262c`. Light theme: warm paper `#f6f5f2`, white panels.
- **Text**: warm white `#ecebe6`, secondary `#9a9c9f`, muted `#62666c`.
- **Accent**: lime `#c6f24a` (action, focus ring, active nav marker only). AI: muted violet `#a393f5`. Warn amber `#e5b04a`, error `#e5675f`, ok `#5fc58b`.
- **Type**: Geist if loadable, else system UI stack; 13px base in dense areas, tabular numerals for data, mono for keys/IDs.
- **Shape**: 6px radius controls, 10px panels, no shadows except overlays, no gradients, no glass.
- **Motion**: 120–180ms opacity/transform only; `prefers-reduced-motion` disables.
- Existing brand: the legacy app uses a warm black/white palette with violet `#6c28d9` as PWA theme colour. Command Center keeps the **RM** monogram and name and the dark warm-black feel; the lime is a new *functional* accent, flagged as a token so it can be swapped in one line.

## Page layouts

- **Home**: 5 stat chips (links) → 8/4 grid. Left: Focus Now + My Day list, Production strip, Activity. Right: Today's schedule, Important inbox, Studio pulse, Quick apps. Widgets hide/restore/reorder (persisted).
- **My Day / Tasks**: left list (groups: Overdue, Today, Upcoming, Unscheduled), right detail panel; view switcher (Today, Upcoming, Week, Overdue, All, Done, Project, Priority); Plan-my-day mode lists unfinished items with explicit *Move to today / Tomorrow / Keep* choices.
- **To Shoot**: header tabs Board / List / Calendar / Timeline; right panel record detail with checklist and linked deliverable.
- **Apps**: dense rows with health dot, filters (All/Favorites/Recent/Available/Needs attention), category chips, add-app dialog.
- **Inbox / Agenda / Studio AI / Health**: honest connection states first, data second.

## Interaction spec

`⌘K` / `Ctrl K` palette (fuzzy, recents, create intents, Enter, Esc, ↑↓). `C` quick capture. `G then H/M/T/S/A` go-to. `X` toggle done on focused row, `J/K` move. Undo toast (6s) for complete/delete. All destructive/AI-created records require confirm.

## Responsive

≥1100 two-column; 768–1099 single column + drawer nav; <768 drawer + bottom action bar, detail panels become full-screen sheets, no horizontal overflow, 44px tap targets.

## Accessibility

Radix dialogs/menus (focus trap, ESC), roles/labels on icon buttons, visible focus ring (lime, 2px), contrast ≥ 4.5:1 on text tokens (checked in review), reduced motion, semantic landmarks (`nav`, `main`, `header`).
