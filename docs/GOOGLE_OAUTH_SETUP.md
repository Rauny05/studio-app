# Google OAuth setup (Gmail + Calendar, read-only)

The app reuses the refresh token already used by the script scanner (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, falling back to `GOOGLE_CLIENT_*`).

1. Google Cloud Console → the existing OAuth client → enable **Gmail API** and **Google Calendar API**.
2. Re-issue the refresh token with scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   (OAuth Playground with your own client, offline access, then copy the refresh token into `GMAIL_REFRESH_TOKEN` in `.env.local` and Vercel. Use `printf`, not `echo`, when piping to `vercel env add`.)
3. Open **Integrations** in the app; Gmail and Calendar should read “connected”.

## Restricted-scope verification
`gmail.readonly` is a **restricted** scope. For personal use of your own account the consent screen can stay in *Testing* mode (test user = your address; tokens expire after 7 days in Testing, so publish to *In production* as an unverified app for your own account, which shows a warning but does not expire). Serving other users requires Google’s OAuth verification plus an annual third-party security assessment. This app is single-owner by design.

## Known gap
There is no in-app “Connect Google” OAuth flow with encrypted per-user token storage. That was specified but not built (see IMPLEMENTATION_STATUS). `CC_TOKEN_ENC_KEY` is reserved for it.
