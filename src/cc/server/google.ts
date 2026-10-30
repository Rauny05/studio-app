import { getAccessToken } from "@/lib/gmail";

let cached: { token: string; exp: number } | null = null;

export const googleConfigured = () =>
  !!((process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID) && (process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET) && process.env.GMAIL_REFRESH_TOKEN);

export async function token(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;
  const t = await getAccessToken();
  cached = { token: t, exp: Date.now() + 45 * 60_000 };
  return t;
}

export type Conn = "ok" | "not_configured" | "scope_missing" | "error";

/** GET a Google API; maps 401/403 to scope_missing so the UI can explain instead of faking data. */
export async function gget<T>(url: string): Promise<{ conn: Conn; data?: T; detail?: string }> {
  if (!googleConfigured()) return { conn: "not_configured" };
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) return { conn: "scope_missing", detail: `HTTP ${res.status}` };
    if (!res.ok) return { conn: "error", detail: `HTTP ${res.status}` };
    return { conn: "ok", data: (await res.json()) as T };
  } catch (e) {
    return { conn: "error", detail: e instanceof Error ? e.message.slice(0, 120) : "failed" };
  }
}
