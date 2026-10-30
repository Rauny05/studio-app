# Deployment

- Dev: `npm run dev` (port 3000) or the “Command Center” launch config (port 3500). Without Redis, state persists to `.cc-data/` (gitignored) and browser localStorage.
- Prod: Vercel as today (`vercel --prod`). Required for full function: `UPSTASH_REDIS_REST_URL/TOKEN` (cloud state), `GMAIL_*` with the two read-only scopes, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Entry point: `/` now redirects to `/home`. Legacy pages remain at their old URLs.
- **Pre-existing build blocker:** `next build` fails type validation at HEAD because `src/app/api/auth/[...nextauth]/route.ts` exports `authOptions` (“not a valid Route export field”). Confirmed by building a clean `git archive HEAD` copy. Fix by moving `authOptions` to e.g. `src/lib/auth.ts` and updating the importers (route, sync route, and `src/cc/server/auth.ts`). Not changed here to avoid touching auth unasked. With that check bypassed, the full app compiles and all Command Center routes build.
- Not deployed in this session.
