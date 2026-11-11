"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { usePrefs, useShoots, useTasks } from "../store/stores";
import { bucketOf } from "../lib/planner";
import { buildContext } from "../lib/context";
import { Panel, toast } from "./ui";
import { useDeliverables, useNow } from "./data";

const SUGGEST = ["What should I work on next?", "Which deliverables are awaiting approval or payment?", "What is coming up this week?", "Which shoots need preparation?"];

/** The context Gemini may read, limited to what the user consented to. Shared by Studio AI and the Home briefing. */
export function useAIContext() {
  const { today } = useNow();
  const tasks = useTasks((s) => s.tasks);
  const shoots = useShoots((s) => s.shoots);
  const { rows } = useDeliverables();
  const aiConsent = usePrefs((s) => s.aiConsent);
  return useMemo(() => buildContext({
    today,
    tasks: aiConsent.tasks ? tasks.filter((t) => t.status !== "done" && t.status !== "dropped").map((t) => ({ title: t.title, status: bucketOf(t, today), priority: t.priority, due: t.due, plannedDate: t.plannedDate, plannedStart: t.plannedStart, project: t.project })) : undefined,
    shoots: aiConsent.studio ? shoots.map((s) => ({ title: s.title, status: s.status, client: s.client, shootDate: s.shootDate, publishDeadline: s.publishDeadline, location: s.location })) : undefined,
    deliverables: aiConsent.studio ? rows.map((r) => ({ pnNo: r.pnNo, brand: r.brand, overallStatus: r.overallStatus, goLiveDate: r.goLiveDate, advance50: r.advance50, payment100: r.payment100, items: r.deliverables.length, itemsDone: r.deliverables.filter((d) => d.status === "Completed").length })) : undefined,
  }), [today, tasks, shoots, rows, aiConsent]);
}

export function StudioAI() {
  const { aiConsent, set } = usePrefs();
  const [q, setQ] = useState("");
  const [out, setOut] = useState<{ title: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const ctx = useAIContext();

  const none = !aiConsent.tasks && !aiConsent.studio;
  const run = async (task: "briefing" | "ask", question?: string) => {
    setBusy(true); setOut(null);
    try {
      const r = await fetch("/api/cc/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, question, context: ctx, consent: true }) });
      const j = await r.json();
      if (!r.ok) { toast(j.error === "not_configured" ? "Gemini is not configured — set GEMINI_API_KEY" : j.error === "rate_limited" ? "Rate limit reached — wait a minute" : "AI request failed", { tone: "err" }); return; }
      setOut({ title: task === "briefing" ? "Daily briefing" : question ?? "Answer", text: j.text });
    } finally { setBusy(false); }
  };

  return (
    <div className="cc-page" style={{ maxWidth: 900 }}>
      <div className="cc-pagehead"><h2>Studio AI</h2><span className="cc-badge ai">Gemini</span><span className="sub">Answers only from data you allow below</span></div>
      <Panel title="What Gemini may see" actions={<button className="cc-btn sm ghost" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Preview payload"}</button>}>
        <div style={{ padding: 14, display: "grid", gap: 8 }}>
          <label><input type="checkbox" style={{ accentColor: "var(--accent)" }} checked={aiConsent.tasks} onChange={(e) => set({ aiConsent: { ...aiConsent, tasks: e.target.checked } })} /> My open tasks (titles, dates, priority, project)</label>
          <label><input type="checkbox" style={{ accentColor: "var(--accent)" }} checked={aiConsent.studio} onChange={(e) => set({ aiConsent: { ...aiConsent, studio: e.target.checked } })} /> Production records and deliverables (brand, status, go-live, payment flags)</label>
          <div className="cc-faint">Email is never included here; it is only sent per-thread from the Inbox, after a confirmation. IDs, card numbers, secrets and email addresses are redacted server-side. Google’s free tier may use submitted data to improve its products.</div>
          {show && <pre className="cc-mono" style={{ margin: 0, maxHeight: 240, overflow: "auto", padding: 10, background: "var(--bg)", borderRadius: 6 }}>{JSON.stringify(ctx, null, 1)}</pre>}
        </div>
      </Panel>
      <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
        <button className="cc-btn primary" disabled={busy || none} onClick={() => run("briefing")}><Sparkles />{busy ? "Thinking…" : "Daily briefing"}</button>
        {SUGGEST.map((s) => <button key={s} className="cc-chip" disabled={busy || none} onClick={() => { setQ(s); void run("ask", s); }}>{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) void run("ask", q.trim()); }} style={{ display: "flex", gap: 8 }}>
        <input className="cc-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your workload, shoots, deliverables…" aria-label="Ask Studio AI" />
        <button className="cc-btn" disabled={busy || none || !q.trim()}>Ask</button>
      </form>
      {none && <p className="cc-faint">Tick at least one data source to enable questions. Nothing is sent until you press a button.</p>}
      {out && <div style={{ marginTop: 16 }}><Panel title={out.title}><div className="cc-prose" style={{ padding: 16 }}>{out.text}</div><div className="cc-faint" style={{ padding: "0 16px 12px", fontSize: 12 }}>AI output can be wrong. It cannot create or edit records; use the Inbox flow to turn suggestions into tasks.</div></Panel></div>}
    </div>
  );
}
