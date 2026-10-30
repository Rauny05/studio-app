"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, ListPlus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { newTask } from "../lib/planner";
import { useTasks, usePrefs } from "../store/stores";
import { ConnBanner, Modal, Panel, Skeleton, fmtDay, toast } from "./ui";
import { useConnector, useNow } from "./data";

export interface Thread { id: string; subject: string; from: string; snippet: string; date: string; unread: boolean; count: number; link: string }
const VIEWS = [["important", "Important"], ["unread", "Unread"], ["followup", "Follow-up"], ["recent", "Recent"]] as const;

const nameOf = (f: string) => f.replace(/<.*>/, "").replace(/"/g, "").trim() || f;

export function Inbox() {
  const sp = useSearchParams();
  const { today } = useNow();
  const [view, setView] = useState<string>(sp.get("q") ? "search" : "important");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [sel, setSel] = useState<Thread | null>(null);
  const url = view === "search" ? (q.trim() ? `/api/cc/gmail?view=search&q=${encodeURIComponent(q)}` : null) : `/api/cc/gmail?view=${view}`;
  const { data, loading, reload } = useConnector<{ conn?: string; detail?: string; threads?: Thread[] }>(url);
  const addTask = useTasks((s) => s.add);

  const day = (d: string) => (d ? fmtDay(new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), today) : "");
  return (
    <div className="cc-view">
      <div className="cc-vbar">
        <div className="cc-vtabs" role="tablist">
          {VIEWS.map(([id, l]) => <button key={id} role="tab" className="cc-vtab" aria-selected={view === id} onClick={() => setView(id)}>{l}</button>)}
          {view === "search" && <button role="tab" className="cc-vtab" aria-selected>Search</button>}
        </div>
        <span className="cc-spacer" />
        <span className="cc-vmeta cc-hide-m">Read-only</span>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) setView("search"); }} className="cc-searchfield sm"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Gmail" aria-label="Search Gmail" /></form>
        <button className="cc-iconbtn" onClick={reload} aria-label="Refresh"><RefreshCw /></button>
      </div>
      {data?.conn === "ok" ? null : data?.conn === "scope_missing" || data?.conn === "error" ? <ConnBanner conn={data.conn} what="Gmail" detail={data.detail} /> : null}
      <div className="cc-vbody">
        <div className="cc-vmain">
          {loading ? <Skeleton rows={6} /> : !data?.threads?.length ? (
            <div className="cc-vempty"><b>{data?.conn && data.conn !== "ok" ? "Gmail is not connected" : "Nothing here"}</b><span>{data?.conn === "ok" ? "No conversations match this view." : "Threads that need action appear here once Gmail is connected."}</span>{data?.conn && data.conn !== "ok" && <Link href="/integrations" className="cc-btn sm">Open integrations</Link>}</div>
          ) : (
            <div className="cc-mlist">{data.threads.map((t) => (
              <button key={t.id} className={`cc-mrow ${t.unread ? "u" : ""}`} data-selected={sel?.id === t.id || undefined} onClick={() => setSel(t)}>
                <i className="ud" aria-label={t.unread ? "Unread" : "Read"} />
                <b className="from">{nameOf(t.from)}{t.count > 1 && <small>{t.count}</small>}</b>
                <span className="body"><span className="subj">{t.subject}</span><span className="snip"> — {t.snippet}</span></span>
                <time>{day(t.date)}</time>
              </button>))}</div>
          )}
        </div>
        {sel && <aside className="cc-vside wide"><ThreadPanel key={sel.id} t={sel} today={today} onClose={() => setSel(null)} onTask={(title, due) => { const t = newTask({ title, due, source: "gmail", sourceRef: sel.id, plannedDate: today }); addTask(t); usePrefs.getState().log(`Task from email: ${title}`, `/tasks?open=${t.id}`); toast("Task created"); }} /></aside>}
      </div>
    </div>
  );
}

interface Suggestion { title: string; due: string | null; reason: string; on: boolean }

function ThreadPanel({ t, today, onTask, onClose }: { t: Thread; today: string; onTask: (title: string, due?: string) => void; onClose: () => void }) {
  const { data, loading } = useConnector<{ conn?: string; subject?: string; messages?: { id: string; from: string; date: string; text: string }[]; link?: string }>(`/api/cc/gmail?thread=${t.id}`);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ summary: string; actions: Suggestion[] } | null>(null);
  const [err, setErr] = useState("");
  const msgs = data?.messages ?? [];
  useEffect(() => { setRes(null); setErr(""); }, [t.id]);

  const run = async () => {
    setOpen(false); setBusy(true); setErr("");
    try {
      const text = msgs.slice(-4).map((m) => `From: ${m.from}\n${m.text.slice(0, 2500)}`).join("\n---\n");
      const r = await fetch("/api/cc/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "email-actions", consent: true, context: { today, subject: t.subject, thread: text } }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error === "not_configured" ? "Gemini is not configured (GEMINI_API_KEY)." : j.error === "rate_limited" ? "Gemini rate limit reached — try again in a minute." : "AI request failed."); return; }
      const p = JSON.parse(j.text) as { summary: string; actions: { title: string; due: string | null; reason: string }[] };
      setRes({ summary: p.summary, actions: (p.actions ?? []).map((a) => ({ ...a, on: true })) });
    } catch { setErr("Could not read the AI response."); } finally { setBusy(false); }
  };

  return (
    <Panel title={t.subject.slice(0, 60)} actions={<><a className="cc-btn sm ghost" href={data?.link ?? t.link} target="_blank" rel="noopener noreferrer">Gmail <ExternalLink /></a><button className="cc-iconbtn" onClick={onClose} aria-label="Close conversation"><X /></button></>}>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="cc-btn sm" onClick={() => setOpen(true)} disabled={busy || loading}><Sparkles />{busy ? "Analyzing…" : "Summarize + actions"}</button>
          <button className="cc-btn sm" onClick={() => onTask(`Reply: ${t.subject}`.slice(0, 120))}><ListPlus />Follow-up task</button>
        </div>
        {err && <div className="cc-banner" role="alert"><div>{err}</div></div>}
        {res && (
          <div style={{ border: "1px solid var(--ai)", borderRadius: 8, padding: 12, marginBottom: 12, background: "var(--ai-soft)" }}>
            <div className="cc-badge ai" style={{ marginBottom: 6 }}>AI suggestion — review before creating</div>
            <p style={{ margin: "0 0 8px" }}>{res.summary}</p>
            {res.actions.length === 0 && <div className="cc-faint">No action items found.</div>}
            {res.actions.map((a, i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
                <input type="checkbox" checked={a.on} style={{ accentColor: "var(--accent)", marginTop: 3 }} onChange={() => setRes({ ...res, actions: res.actions.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                <span style={{ flex: 1 }}><input className="cc-input" style={{ height: 26 }} value={a.title} onChange={(e) => setRes({ ...res, actions: res.actions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <span className="cc-faint" style={{ fontSize: 12 }}>{a.reason}</span></span>
                <input type="date" className="cc-input" style={{ width: 130, height: 26 }} value={a.due ?? ""} onChange={(e) => setRes({ ...res, actions: res.actions.map((x, j) => (j === i ? { ...x, due: e.target.value || null } : x)) })} />
              </label>
            ))}
            {res.actions.some((a) => a.on) && <button className="cc-btn primary sm" style={{ marginTop: 8 }} onClick={() => { res.actions.filter((a) => a.on && a.title.trim()).forEach((a) => onTask(a.title.trim(), a.due ?? undefined)); setRes(null); }}>Create {res.actions.filter((a) => a.on).length} task(s)</button>}
          </div>
        )}
        {loading ? <Skeleton rows={5} /> : msgs.map((m) => (
          <div key={m.id} style={{ marginBottom: 14 }}>
            <div className="cc-faint" style={{ fontSize: 12 }}>{nameOf(m.from)} · {m.date}</div>
            <div className="cc-prose" style={{ fontSize: 13 }}>{m.text.slice(0, 1800)}{m.text.length > 1800 ? "…" : ""}</div>
          </div>
        ))}
        <div className="cc-faint" style={{ fontSize: 11 }}>Bodies are shown from Gmail on demand and are never stored.</div>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Send this thread to Gemini?">
        <p className="cc-muted" style={{ marginTop: 0 }}>The last {Math.min(4, msgs.length)} message(s) of “{t.subject}” will be sent to Google’s Gemini API after automatic redaction of IDs, card numbers and secrets. Sender names are kept so actions make sense. On Google’s free tier, submitted content may be used to improve Google’s products.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="cc-btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="cc-btn primary" onClick={run}>Send to Gemini</button></div>
      </Modal>
    </Panel>
  );
}
