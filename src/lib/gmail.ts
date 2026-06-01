/**
 * Gmail API helper — OAuth 2.0 with stored refresh token.
 * Fetches emails matching "scripts to check" subject filter,
 * extracts title + Google Doc URL, returns structured records.
 */

export interface ScriptDocEntry {
  name: string;
  doc_url: string;
}

export interface GmailScriptEmail {
  gmail_message_id: string;
  title: string;
  docs: ScriptDocEntry[];   // All script docs found in the email
  sender_name: string;
  sender_email: string;
  received_at: string; // ISO 8601
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** Fetch the title of a Google Doc by its document ID using the Drive API */
async function fetchDocTitle(docId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${DRIVE_API}/files/${docId}?fields=name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { name?: string };
    return data.name?.replace(/\.gdoc$/i, "").trim() || null;
  } catch {
    return null;
  }
}

/** Extract Google Doc ID from a docs.google.com URL */
function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Exchange refresh token for a short-lived access token */
export async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      // Fall back to GOOGLE_CLIENT_* since it's the same OAuth app
      client_id: (process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID)!,
      client_secret: (process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET)!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token refresh failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { access_token: string };
  return json.access_token;
}

/** Extract sender name and email from a "From" header value */
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2].trim() };
  }
  return { name: from.trim(), email: from.trim() };
}

/** Strip "Scripts to check", "Fwd:", "Re:", "Fw:" prefixes and return the remainder */
function extractTitle(subject: string): string {
  const cleaned = subject
    .replace(/^(fwd?|re)\s*:\s*/i, "")       // strip Fwd: / Re: / Fw:
    .replace(/^scripts\s+to\s+check\s*[–—:\-]\s*/i, "")
    .trim();
  return cleaned || subject;
}

/**
 * Extract all Google Doc links with their names from email body.
 * Checks same line and previous line for a script name.
 * If no name found, fetches the doc title from the Drive API.
 */
async function extractScriptDocs(text: string, accessToken: string): Promise<ScriptDocEntry[]> {
  const DOC_PATTERN = /https:\/\/docs\.google\.com\/document\/[^\s"'<>)\]]+/gi;
  const results: ScriptDocEntry[] = [];
  let match: RegExpExecArray | null;
  const lines = text.split("\n");

  while ((match = DOC_PATTERN.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:]+$/, "");

    // Find which line this URL is on
    let charCount = 0;
    let urlLineIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount > match.index) { urlLineIdx = i; break; }
    }

    // Helper: clean a candidate name string
    const clean = (s: string) => {
      const r = s
        .replace(/^[>|\s]+/, "")          // strip Gmail quote markers (>, |) and leading spaces
        .replace(/^[\d]+[.)]\s*/, "")     // strip list numbers
        .replace(/^[-*•]\s*/, "")         // strip bullet markers
        .replace(/[:\-–—]\s*$/, "")       // strip trailing colons/dashes
        .replace(/https?:\/\/\S+/g, "")   // remove any URLs
        .trim();
      // Reject if result is just symbols/whitespace or very short non-word
      return /\w{2,}/.test(r) ? r : "";
    };

    // 1. Text on the same line BEFORE the URL
    const lineStart = text.lastIndexOf("\n", match.index) + 1;
    const sameLine = clean(text.slice(lineStart, match.index));

    // 2. Previous non-empty line
    let prevLine = "";
    for (let i = urlLineIdx - 1; i >= 0; i--) {
      const l = clean(lines[i]);
      if (l && !l.match(/^https?:\/\//)) { prevLine = l; break; }
    }

    let name = sameLine || prevLine;
    if (!name) {
      // Try to get the real document title from Drive API
      const docId = extractDocId(url);
      if (docId) name = await fetchDocTitle(docId, accessToken) ?? "";
    }
    results.push({ name: name || `Script ${results.length + 1}`, doc_url: url });
  }

  return results;
}

/** Decode base64url to UTF-8 string */
function b64decode(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** Recursively extract all text from Gmail message parts */
function extractBodyText(payload: GmailPayload): string {
  if (payload.body?.data) {
    return b64decode(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  return "";
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: { name: string; value: string }[];
}

interface GmailMessage {
  id: string;
  internalDate?: string;
  payload?: GmailPayload;
}

/**
 * Poll Gmail for messages matching subject filter.
 * Returns only messages received after `afterEpochMs` (defaults to last 2 minutes).
 */
export async function fetchNewScriptEmails(
  afterEpochMs?: number
): Promise<GmailScriptEmail[]> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Gmail search: subject contains "scripts to check", received recently
  const afterSec = Math.floor((afterEpochMs ?? Date.now() - 120_000) / 1000);
  const q = encodeURIComponent(`subject:"scripts to check" after:${afterSec}`);

  const listRes = await fetch(
    `${GMAIL_API}/users/me/messages?q=${q}&maxResults=20`,
    { headers }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail list failed (${listRes.status}): ${await listRes.text()}`);
  }

  const listData = await listRes.json() as { messages?: { id: string }[] };
  const messages = listData.messages ?? [];

  const results: GmailScriptEmail[] = [];

  for (const { id } of messages) {
    try {
      const msgRes = await fetch(
        `${GMAIL_API}/users/me/messages/${id}?format=full`,
        { headers }
      );
      if (!msgRes.ok) continue;

      const msg = await msgRes.json() as GmailMessage;
      const hdrs = msg.payload?.headers ?? [];
      const get = (name: string) =>
        hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

      const subject = get("Subject");
      // Double-check subject filter (in case Gmail search is loose)
      if (!subject.toLowerCase().includes("scripts to check")) continue;

      const from = get("From");
      const date = get("Date");
      const { name: sender_name, email: sender_email } = parseSender(from);

      const bodyText = extractBodyText(msg.payload ?? {});
      const docs = await extractScriptDocs(bodyText, token);
      const title = extractTitle(subject);

      // Parse received_at: prefer internalDate (ms epoch) over Date header
      let received_at: string;
      if (msg.internalDate) {
        received_at = new Date(Number(msg.internalDate)).toISOString();
      } else {
        received_at = date ? new Date(date).toISOString() : new Date().toISOString();
      }

      results.push({
        gmail_message_id: id,
        title,
        docs,
        sender_name,
        sender_email,
        received_at,
      });
    } catch {
      // Skip malformed messages
      continue;
    }
  }

  return results;
}

/**
 * Parse a Gmail Pub/Sub push notification payload.
 * Returns the historyId to fetch from.
 */
export function parsePubSubPayload(body: unknown): { email: string; historyId: string } | null {
  try {
    const b = body as { message?: { data?: string } };
    if (!b.message?.data) return null;
    const decoded = b64decode(b.message.data);
    const json = JSON.parse(decoded) as { emailAddress: string; historyId: string };
    return { email: json.emailAddress, historyId: String(json.historyId) };
  } catch {
    return null;
  }
}

/**
 * Fetch messages added since a given historyId (used for Pub/Sub notifications).
 */
export async function fetchMessagesSinceHistory(
  historyId: string
): Promise<GmailScriptEmail[]> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const histRes = await fetch(
    `${GMAIL_API}/users/me/history?startHistoryId=${historyId}&historyTypes=messageAdded`,
    { headers }
  );

  if (!histRes.ok) return [];

  const data = await histRes.json() as {
    history?: { messagesAdded?: { message: { id: string } }[] }[]
  };

  const ids = (data.history ?? []).flatMap(
    (h) => (h.messagesAdded ?? []).map((m) => m.message.id)
  );

  if (!ids.length) return [];

  const results: GmailScriptEmail[] = [];

  for (const id of ids) {
    try {
      const msgRes = await fetch(
        `${GMAIL_API}/users/me/messages/${id}?format=full`,
        { headers }
      );
      if (!msgRes.ok) continue;

      const msg = await msgRes.json() as GmailMessage;
      const hdrs = msg.payload?.headers ?? [];
      const get = (name: string) =>
        hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

      const subject = get("Subject");
      if (!subject.toLowerCase().includes("scripts to check")) continue;

      const from = get("From");
      const { name: sender_name, email: sender_email } = parseSender(from);
      const bodyText = extractBodyText(msg.payload ?? {});
      const docs = await extractScriptDocs(bodyText, token);
      const title = extractTitle(subject);
      const received_at = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString();

      results.push({ gmail_message_id: id, title, docs, sender_name, sender_email, received_at });
    } catch {
      continue;
    }
  }

  return results;
}
