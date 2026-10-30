# App integration architecture

RM Studio is the single host. Everything opens inside its shell; nothing launches externally.

## Routes

| Route | Renders | Source |
|---|---|---|
| `/home`, `/my-day`, `/tasks`, `/to-shoot`, `/inbox`, `/agenda`, `/operations`, `/studio-ai` | Native Command Center modules | `src/app/(cc)/*`, `src/cc/components/*` |
| `/studio/[...path]` | The original RM Studio pages (Deliverables, Scripts, Settings, Todos…), same-origin, inside the shell | `src/cc/components/StudioModule.tsx` |
| `/workspace/apps/[appSlug]` | An approved application | `src/cc/components/AppWorkspace.tsx` |
| `/apps` | Application launcher; `/apps?view=diagnostics` is the admin integration screen | `src/cc/components/Apps.tsx` |

## Components (as asked for in the brief)

| Role | Implementation |
|---|---|
| WorkspaceLayout / Header / Sidebar | `Shell.tsx`: persistent sidebar (core nav, Studio, pinned/recent apps), header with breadcrumbs, New, notifications. Hosted pages inject their name and controls into the header via `useUI().setHeaderExtra`. |
| ApplicationResolver | `src/cc/apps/adapter.ts` `resolveSlug` + `resolveApp`: registry record + live probe → `native` / `embedded` / `integrated`. Pure and unit-tested (`tests/cc-adapter.test.ts`). |
| ApplicationHost | `ApplicationHost` in `AppWorkspace.tsx`: marks the app as opened, re-probes it, renders the frame or the status page, owns reload/fullscreen/switcher. |
| EmbeddedApplicationFrame | Full-bleed iframe filling `main`; loading overlay, slow-load hint, reload, fullscreen. Sandbox: scripts, same-origin, forms, popups, modals, downloads. **No `allow-top-navigation`**, so an app can never navigate RM Studio away. |
| NativeApplicationModule | Command Center modules; `StudioModule` for the original RM Studio pages. |
| ApplicationErrorBoundary | Wraps the host; a crash shows a retry panel while the shell stays usable. |

## Registry

`data/app-registry.json`, served by `/api/cc/apps`. Each record has `kind`: `app` (shown), `host` (RM Studio itself; its workspace URL redirects to Home) or `excluded` (with `excludeReason`, visible only in the diagnostics view). `useAppRegistry()` returns `apps` (approved only) and `all`. User-added apps are always `kind: "app"`.

## One RM Studio, never two

- Original pages opened directly (`/deliverables`, bookmarks, old links) redirect to `/studio/...` (`/dashboard` → `/home`). The Capacitor Android wrapper is exempt and keeps its own shell.
- When framed by the shell, the original `AppShell` drops its sidebar/navbar; data stores, sync, session and business logic are unchanged.
- A Command Center page that somehow loads inside a frame hands navigation to the top window instead of nesting a second shell.
- In-module navigation is mirrored into the address bar (`history.replaceState`), so refresh and back keep the exact page.

## Authentication

- RM Studio’s own modules share the NextAuth session (same origin).
- Embedded apps keep their own sign-in, shown inside the frame. No tokens are passed in URLs and nothing is stored in localStorage by RM Studio.
- Shared sign-on was investigated: the Supabase-backed apps use separate projects on separate `vercel.app` sites (a public suffix, so cross-site to each other and to RM Studio). A shared session needs either one auth provider across apps or a common registrable domain with a parent-domain cookie. Neither exists today; not implemented.

## Health and diagnostics

`/api/cc/health` probes each app server-side (6s timeout, 60s cache, SSRF guard) and reads `X-Frame-Options` / CSP `frame-ancestors` against the requesting origin. A blocked app becomes `integrated` with exact requirements instead of a blank frame.

## Tests

- Unit: `npm test` (32).
- End-to-end: `npm run test:e2e` with `CC_E2E_PROFILE` (signed-in Chromium profile) and `CC_E2E_CHROME`. It covers: every approved app opened from the library, origin never changes, shell always visible, real app content in the frame, frame fills the workspace, switching without reload, back/forward, refresh, ⌘K switching, the notes alias, Studio modules without a second sidebar, direct old-URL redirect, library contents (no portfolios, internal links only), no popups, no frame-blocking errors. Screenshots and `report.json` go to `e2e-results/`.
