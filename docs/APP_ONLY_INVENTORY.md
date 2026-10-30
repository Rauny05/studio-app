# Application inventory (apps only)

Built 2026-10-30 from the 35 projects in the ClaudeHQ registry, their source folders, `.vercel/project.json` links and live deployments. A project is listed as an application only if it is a working tool with an interactive interface. Portfolios, marketing sites, video projects, CLI pipelines, bots and mobile-only apps are excluded and listed separately.

“Embedding result” comes from the automated suite (`npm run test:e2e`, run 2026-10-30, 33/33 passing): each app was opened by clicking it in the library, inside a signed-in RM Studio session.

## Approved applications (15)

| Application | Purpose | Location | Deployment | Authentication | Integration | Internal route | Embedding result | Decision |
|---|---|---|---|---|---|---|---|---|
| BillVault | Capture bills and receipts, OCR the amounts, track who paid, export to Drive or Obsidian. | `/Users/raunaqrm/Downloads/billvault` | https://billvault-wheat.vercel.app | Own sign-in, shown inside the frame | Embedded (iframe) | `/workspace/apps/billvault` | Renders inside RM Studio (“BillVault”) | Approved |
| Expense Tracker | Team expense tracking with OCR import and monthly budgets. | `/Users/raunaqrm/Downloads/expense-tracker-claudecode/expense-cc` | https://expense-cc.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/expense-tracker` | Renders inside RM Studio (“Expenses”) | Approved |
| Ledger | Personal expense tracker. Offline-first PWA, data stays in the browser. | `/Users/raunaqrm/Downloads/ledger` | https://ledger-blush-eight.vercel.app | Own sign-in, shown inside the frame | Embedded (iframe) | `/workspace/apps/ledger` | Renders inside RM Studio (“Ledger — Smart Expense Tracker”) | Approved |
| DeskBoard | Realtime studio task board; the same board runs on the Xiaomi tablet. | `/Users/raunaqrm/Downloads/deskboard` | https://deskboard-five.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/deskboard` | Renders inside RM Studio (“DeskBoard”) | Approved |
| Cardstock Notes | Notes app in daily use on web and Android, synced through PocketBase. | `/Users/raunaqrm/Projects/cardstock` | https://cardstock-alpha.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/cardstock` | Renders inside RM Studio (“Cardstock”) | Approved |
| Scriptboard | Collaborative script writing and review. | `/Users/raunaqrm/Projects/scriptboard` | https://scriptboard.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/scriptboard` | Renders inside RM Studio (“Scriptboard”); app has its own horizontal overflow | Approved |
| ScriptFlow AI | Turns Docs/Pages scripts and captions into clean teleprompter and Notes-ready text. | `/Users/raunaqrm/Downloads/script-formatter` | https://script-formatter-eight.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/script-formatter` | Renders inside RM Studio (“ScriptFlow AI — Script Formatting Compiler”) | Approved |
| OTP Mock Studio | Simulates OTP message floods on mock phones for video shoots, with screen recording. | `/Users/raunaqrm/Downloads/otp-mock-studio` | https://otp-mock-studio.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/otp-mock-studio` | Renders inside RM Studio (“otp-mock-studio”) | Approved |
| R.Clipper | Clip review dashboard for the YouTube clipper pipeline. Runs on this Mac. | `/Users/raunaqrm/Downloads/jarvis-clipper` | http://localhost:4001 | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/jarvis-clipper` | Renders inside RM Studio (“R.CLIPPER”) | Approved |
| SwiftDrop | AirDrop-style peer-to-peer file transfer between devices over WebRTC. | `/Users/raunaqrm/Downloads/swiftdrop` | https://swiftdrop-three.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/swiftdrop` | Renders inside RM Studio (“SwiftDrop”) | Approved |
| VaultDrop | Self-hosted file vault and sharing, served from this Mac over Tailscale Funnel. | `/Users/raunaqrm/Downloads/vaultdrop` | https://raunaqss-macbook-pro.tail0cb91d.ts.net | — | Integration status | `/workspace/apps/vaultdrop` | Integration status: Self-hosted file vault and sharing, served from this Mac over Tailscale Funnel. | Approved |
| Product Ledger | Inventory of products received from and returned to agencies, with returns tracking. | `/Users/raunaqrm/Downloads/product-ledger` | https://product-ledger.product-ledger-worker.workers.dev | Own sign-in, shown inside the frame | Embedded (iframe) | `/workspace/apps/product-ledger` | Renders inside RM Studio (“Product Ledger”) | Approved |
| Leave Tracker | Team attendance, leave requests and approvals. | `/Users/raunaqrm/Downloads/leave-tracker` | https://leave-tracker-pearl.vercel.app | Own sign-in, shown inside the frame | Embedded (iframe) | `/workspace/apps/leave-tracker` | Renders inside RM Studio (“Leave Tracker”) | Approved |
| Leave & Overtime Tracker | Simple leave and overtime log for the team. | `/Users/raunaqrm/Downloads/leave-overtime-tracker` | https://leave-overtime-tracker.vercel.app | Own sign-in, shown inside the frame | Embedded (iframe) | `/workspace/apps/leave-overtime-tracker` | Renders inside RM Studio (“Leave & Overtime”) | Approved |
| Broadcast | Send realtime red-alert broadcasts to team devices. | `/Users/raunaqrm/Downloads/broadcast` | https://broadcast-khaki.vercel.app | No sign-in screen at entry | Embedded (iframe) | `/workspace/apps/broadcast` | Renders inside RM Studio (“BROADCAST”) | Approved |

Aliases: `/workspace/apps/notes` → Cardstock Notes, `/workspace/apps/expenses` → Expense Tracker.

## RM Studio’s own modules (host, not in the library)

| Module | Route | How it runs |
|---|---|---|
| Home, My Day, Tasks, To Shoot, Inbox, Calendar, Operations, Studio AI | `/home`, `/my-day`, … | Native Command Center pages |
| Deliverables | `/studio/deliverables` | Original RM Studio page, same-origin, inside the shell |
| Scripts (the old Projects route already redirected here) | `/studio/scripts` | Original page, inside the shell |
| Settings, Todos, Studio calendar, Admin | `/studio/settings`, `/studio/todos`, … | Original pages, inside the shell |

## Excluded projects (19)

| Project | Location | Reason |
|---|---|---|
| RM Studio (Unverified Mirror) | `/Users/raunaqrm/Downloads/studio-app` | Duplicate of RM Studio under a different remote; not a separate app. |
| Batta Portfolio | `/Users/raunaqrm/Downloads/batta-portfolio` | Portfolio website. |
| Raunaq Singh Portfolio | `/Users/raunaqrm/Downloads/singh-portfolio` | Portfolio website. |
| Sakshi Gujral Portfolio V2 | `/Users/raunaqrm/Downloads/sg-portfolio-v2` | Portfolio website. |
| Sakshi Gujral Portfolio V1 | `/Users/raunaqrm/Downloads/sakshi-portfolio` | Portfolio website. |
| My Video (Remotion) | `/Users/raunaqrm/Downloads/my-video` | Remotion video project; renders video, no application interface. |
| Notes App | `/Users/raunaqrm/Downloads/notes-app` | Not deployed: no Supabase backend exists yet. Cardstock is the notes app in real use. |
| Retype | `/Users/raunaqrm/Downloads/retype` | Local Vite tool, not deployed and not running; revisit once hosted. |
| SwiftDrop BT | `/Users/raunaqrm/Downloads/swiftdrop-bt` | Mobile app (Flutter); no web surface to host. |
| NearDrop | `/Users/raunaqrm/Downloads/neardrop` | Mobile app (Flutter); no web surface to host. |
| RM Studio Native | `/Users/raunaqrm/Downloads/RMStudio-Native` | Mobile client of RM Studio; RM Studio itself is the host. |
| RM Studio Tablet | `/Users/raunaqrm/Downloads/RMStudio-Tablet` | Android client of RM Studio; RM Studio itself is the host. |
| Vitality Health | `/Users/raunaqrm/Downloads/vitality-health` | Android app; no web surface. |
| Email Digest | `/Users/raunaqrm/Downloads/email-digest` | Background Gmail digest bot; its function is covered natively by the RM Studio Inbox. |
| ClaudeHQ | `/Users/raunaqrm/Downloads/ClaudeHQ` | Discord bot bridge; no application interface. |
| PersonalCloud | `/Users/raunaqrm/Downloads/PersonalCloud` | Discord-controlled storage bot; no web interface. |
| Reel Editor | `/Users/raunaqrm/Downloads/reel-editor` | CLI pipeline; no application interface. |
| YouTube Clipper | `/Users/raunaqrm/Downloads/youtube-clipper` | CLI scripts; its UI is R.Clipper. |
| Claude Command Center | `/Users/raunaqrm/Projects/claude-command-center` | Separate dashboard experiment, superseded by RM Studio. |
