# Application embedding matrix

Live header probe (`curl -I`, redirects followed) and automated in-browser result, 2026-10-30. Origin under test: `http://localhost:3000` (the Command Center is not deployed yet).

| Application | Route | X-Frame-Options / frame-ancestors | Renders inside RM Studio | Sign-in screen at entry | Framed cookies | Outstanding |
|---|---|---|---|---|---|---|
| BillVault | `/workspace/apps/billvault` | none sent | Yes | Yes | Work (Chromium) | Sign in once inside the frame (not automated: no test credentials for production). |
| Expense Tracker | `/workspace/apps/expense-tracker` | none sent | Yes | No | Work (Chromium) | — |
| Ledger | `/workspace/apps/ledger` | none sent | Yes | Yes | Work (Chromium) | Sign in once inside the frame (not automated: no test credentials for production). |
| DeskBoard | `/workspace/apps/deskboard` | none sent | Yes | No | Work (Chromium) | — |
| Cardstock Notes | `/workspace/apps/cardstock` | none sent | Yes | No | Work (Chromium) | — |
| Scriptboard | `/workspace/apps/scriptboard` | none sent | Yes | No | Work (Chromium) | — |
| ScriptFlow AI | `/workspace/apps/script-formatter` | none sent | Yes | No | Work (Chromium) | — |
| OTP Mock Studio | `/workspace/apps/otp-mock-studio` | none sent | Yes | No | Work (Chromium) | — |
| R.Clipper | `/workspace/apps/jarvis-clipper` | localhost (no headers) | Yes | No | Work (Chromium) | Only reachable while RM Studio and the tool both run on this Mac. |
| SwiftDrop | `/workspace/apps/swiftdrop` | none sent | Yes | No | Work (Chromium) | — |
| VaultDrop | `/workspace/apps/vaultdrop` | not reachable | No — integration status | — | — | Tailscale Funnel URL timed out: the Mac-hosted server was not running. Embeds automatically once it is. |
| Product Ledger | `/workspace/apps/product-ledger` | none sent | Yes | Yes | Work (Chromium) | Sign in once inside the frame (not automated: no test credentials for production). |
| Leave Tracker | `/workspace/apps/leave-tracker` | none sent | Yes | Yes | Work (Chromium) | Sign in once inside the frame (not automated: no test credentials for production). |
| Leave & Overtime Tracker | `/workspace/apps/leave-overtime-tracker` | none sent | Yes | Yes | Work (Chromium) | Sign in once inside the frame (not automated: no test credentials for production). |
| Broadcast | `/workspace/apps/broadcast` | none sent | Yes | No | Work (Chromium) | — |

## What “Yes” means

The suite clicked the app in the library, confirmed the browser stayed on the RM Studio origin with the shell visible, waited for the frame to finish loading, confirmed the frame is the app’s own origin with real content, and checked that the frame fills the workspace. No new tabs were opened and no frame-blocking console errors were logged during the whole run.

## Changes to app repositories

None were required: no approved app sends a frame-blocking header, so all render as-is. Recommended hardening (not applied, needs a redeploy per app): send `Content-Security-Policy: frame-ancestors 'self' https://rmmedia-studio.vercel.app http://localhost:3000` so only RM Studio can frame them. Today any site can.

## Known limits

- **Third-party cookies.** Every `*.vercel.app` app is cross-site to RM Studio. Chromium kept cookies inside the frame (probe passed). Safari and Brave block third-party cookies by default, so apps with their own sign-in may not keep a session there. Durable fix: put RM Studio and the apps on one registrable domain (e.g. subdomains of rmmedia.in).
- **Real sign-in inside a frame was not automated** for BillVault, Ledger, Product Ledger, Leave Tracker and Leave & Overtime: entering production credentials from a test is not allowed. Verify once by hand.
- Links an app itself opens with `target="_blank"` (e.g. a download) still open a tab; the frame cannot navigate RM Studio away (sandbox without `allow-top-navigation`).
