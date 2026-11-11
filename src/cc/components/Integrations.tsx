"use client";

import { useEffect, useState } from "react";
import { Panel } from "./ui";
import { useConnector } from "./data";
import { useSyncStatus } from "../store/sync";

type Row = { name: string; state: string; tone: "ok" | "warn" | "err" | ""; detail: string };

export function Integrations() {
  const sync = useSyncStatus((s) => s.state);
  const gmail = useConnector<{ conn?: string; detail?: string }>("/api/cc/gmail?view=unread");
  const today = new Date().toISOString().slice(0, 10);
  const cal = useConnector<{ conn?: string; detail?: string }>(`/api/cc/calendar?from=${today}&to=${today}`);
  const [ai, setAi] = useState<{ configured: boolean; model: string; usage: Record<string, number> } | null>(null);
  useEffect(() => { fetch("/api/cc/ai").then((r) => r.json()).then(setAi).catch(() => setAi(null)); }, []);

  const g = (c?: { conn?: string; detail?: string } | null, scope?: string): Row["state"] => !c ? "checking" : c.conn === "ok" ? "connected" : c.conn === "not_configured" ? "not configured" : c.conn === "scope_missing" ? `scope missing${scope ? ` (${scope})` : ""}` : "error";
  const rows: Row[] = [
    { name: "Cloud storage (tasks, shoots, preferences)", state: sync === "synced" ? "connected" : sync === "local" ? "local only" : sync, tone: sync === "synced" ? "ok" : sync === "error" ? "err" : "warn",
      detail: sync === "local" ? "Upstash Redis env vars are not set. Data lives in this browser only." : "Upstash Redis (prod) or .cc-data (dev)." },
    { name: "Gmail (read-only)", state: g(gmail.data, "gmail.readonly"), tone: gmail.data?.conn === "ok" ? "ok" : "warn", detail: "Uses GMAIL_CLIENT_ID / SECRET / REFRESH_TOKEN. See docs/GOOGLE_OAUTH_SETUP.md." },
    { name: "Google Calendar (read-only)", state: g(cal.data, "calendar.readonly"), tone: cal.data?.conn === "ok" ? "ok" : "warn", detail: "Same refresh token must include calendar.readonly." },
    { name: "Gemini", state: ai ? (ai.configured ? `configured · ${ai.model}` : "not configured") : "checking", tone: ai?.configured ? "ok" : "warn", detail: "GEMINI_API_KEY and GEMINI_MODEL (server env). Key never reaches the browser." },
    { name: "Google Sheet (deliverables)", state: "owned by RM Studio", tone: "ok", detail: "Read through /api/deliverables; Command Center never writes it." },
  ];
  const usageToday = ai?.usage?.[new Date().toISOString().slice(0, 10)] ?? 0;
  return (
    <div className="cc-page">
      <div className="cc-pagehead"><h2>Integrations</h2><span className="sub">Honest connection status</span></div>
      <Panel title="Connections">
        {rows.map((r) => (
          <div key={r.name} className="cc-item" style={{ alignItems: "flex-start", padding: "12px 14px" }}>
            <div style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{r.name}</b><div className="cc-faint">{r.detail}</div></div>
            <span className={`cc-badge ${r.tone}`}>{r.state}</span>
          </div>
        ))}
      </Panel>
      {ai?.configured && <p className="cc-muted" style={{ marginTop: 12 }}>Gemini requests today (UTC day): {usageToday}. Free-tier quotas are enforced by Google; a 429 is reported in the UI as “rate limited”.</p>}
      <p className="cc-faint">Connections are configured with server environment variables, so there is no in-app “disconnect” — remove the variable (or revoke the token in your Google account) to disconnect.</p>
    </div>
  );
}
