# Gemini setup

1. Create a key in Google AI Studio.
2. Set server env vars (never `NEXT_PUBLIC_`):
   - `GEMINI_API_KEY=…`
   - `GEMINI_MODEL=…` (default in code: `gemini-2.5-flash`)
3. Verify on **Integrations**.

**Model/quota not verified.** Third-party sources disagree about which Gemini models are on the free tier (2.5 Flash/Flash-Lite and 3.x Flash previews were mentioned). Check <https://ai.google.dev/gemini-api/docs/pricing> and set `GEMINI_MODEL` accordingly. Preview models have tighter limits. A 429 surfaces as “rate limited” in the UI.

## Privacy controls implemented
- Nothing is sent without a button press; Studio AI shows a per-source consent checkbox and a payload preview.
- Email: per-thread confirmation dialog; last 4 messages only.
- Server-side redaction (`src/cc/lib/redact.ts`): IDs/PAN/Aadhaar-like numbers, cards, IFSC, API keys, `password:`-style secrets, phone numbers; email addresses removed except in the email-actions task.
- Daily usage counter stored under `cc:state:ai-usage`.
- AI cannot write records. Email suggestions become tasks only after the user ticks and confirms them.
- Free-tier terms may let Google use submitted data to improve its products.
