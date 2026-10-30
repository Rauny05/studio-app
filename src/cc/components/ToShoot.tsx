"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ExternalLink, Plus, Search, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { useShoots, usePrefs, useTasks } from "../store/stores";
import { addDays, newTask, startOfWeek, diffDays } from "../lib/planner";
import { calendarEntries, readiness, type Shoot } from "../lib/shoots";
import { Empty, Modal, Panel, Prio, fmtDay, MONTH_NAMES, toast } from "./ui";
import { useDeliverables, useNow } from "./data";
import { useUI } from "./ui-store";

const VIEWS = ["Board", "List", "Calendar", "Timeline"] as const;
type V = (typeof VIEWS)[number];

export function ToShoot() {
  const sp = useSearchParams();
  const { today } = useNow();
  const st = useShoots();
  const ui = useUI();
  const [view, setView] = useState<V>("Board");
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cfg, setCfg] = useState(false);
  const [sort, setSort] = useState<{ k: keyof Shoot; dir: 1 | -1 }>({ k: "shootDate", dir: 1 });

  useEffect(() => { const o = sp.get("open"); if (o) setSel(o); }, [sp]);
  const list = useMemo(() => st.shoots.filter((s) => !q || `${s.title} ${s.client ?? ""} ${s.brand ?? ""} ${s.campaign ?? ""}`.toLowerCase().includes(q.toLowerCase())), [st.shoots, q]);
  const columns = useMemo(() => { const extra = Array.from(new Set(list.map((s) => s.status))).filter((x) => !st.statuses.includes(x)); return [...st.statuses, ...extra]; }, [st.statuses, list]);
  const selected = st.shoots.find((s) => s.id === sel) ?? null;

  const upcomingN = st.shoots.filter((s) => s.shootDate && s.shootDate >= today && !["Shot", "Published"].includes(s.status)).length;
  return (
    <div className="cc-view">
      <div className="cc-vbar">
        <div className="cc-vtabs" role="tablist">{VIEWS.map((v) => <button key={v} role="tab" aria-selected={view === v} className="cc-vtab" onClick={() => setView(v)}>{v}</button>)}</div>
        <span className="cc-spacer" />
        <span className="cc-vmeta cc-hide-m">{st.shoots.length} {st.shoots.length === 1 ? "record" : "records"} · {upcomingN} upcoming</span>
        <label className="cc-searchfield sm"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Search shoots" /></label>
        <button className="cc-iconbtn" onClick={() => setCfg(true)} aria-label="Configure statuses"><Settings2 /></button>
        <button className="cc-btn sm primary" onClick={() => ui.openCapture("shoot")}><Plus /><span className="cc-hide-m">Add shoot</span></button>
      </div>
      <div className="cc-vbody">
        <div className="cc-vmain">
          {st.shoots.length === 0 && <div className="cc-vempty"><b>No production records yet</b><span>Add an idea or a booked shoot. Link it to an existing deliverable instead of duplicating one.</span><button className="cc-btn primary sm" onClick={() => ui.openCapture("shoot")}><Plus />Add shoot</button></div>}
          {st.shoots.length > 0 && view === "Board" && (
            <div className="cc-board">
              {columns.map((col) => {
                const items = list.filter((s) => s.status === col);
                return (
                  <div key={col} className="cc-colm" data-empty={items.length === 0 || undefined} onDragOver={(e) => { e.preventDefault(); e.currentTarget.setAttribute("data-over", "true"); }} onDragLeave={(e) => e.currentTarget.removeAttribute("data-over")}
                    onDrop={(e) => { e.currentTarget.removeAttribute("data-over"); const id = e.dataTransfer.getData("text/shoot"); if (id) { st.move(id, col); } }}>
                    <div className="cc-colm-hd"><i className="cc-stage" data-s={col} />{col}<span className="cc-faint">{items.length}</span></div>
                    <div className="cc-colm-body">
                      {items.map((s) => <ShootCard key={s.id} s={s} today={today} on={sel === s.id} onOpen={() => setSel(s.id)} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {st.shoots.length > 0 && view === "List" && (
            <div className="cc-tablewrap">
              <table className="cc-table">
                <thead><tr>{([["title", "Title"], ["status", "Status"], ["client", "Client"], ["shootDate", "Shoot"], ["publishDeadline", "Publish"], ["priority", "Prio"], ["location", "Location"]] as const).map(([k, l]) =>
                  <th key={k} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1) : 1 }))}>{l}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</th>)}<th>Ready</th></tr></thead>
                <tbody>{[...list].sort((a, b) => String(a[sort.k] ?? "\uffff").localeCompare(String(b[sort.k] ?? "\uffff")) * sort.dir).map((s) => (
                  <tr key={s.id} onClick={() => setSel(s.id)} data-selected={sel === s.id || undefined} style={{ cursor: "pointer" }}>
                    <td className="strong">{s.title}</td><td><span className="cc-status-tag">{s.status}</span></td><td>{s.client ?? s.brand ?? "—"}</td><td>{s.shootDate ? fmtDay(s.shootDate, today) : "—"}</td>
                    <td>{s.publishDeadline ? fmtDay(s.publishDeadline, today) : "—"}</td><td><Prio p={s.priority} /></td><td>{s.location ?? "—"}</td><td>{readiness(s).pct}%</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
          {st.shoots.length > 0 && view === "Calendar" && <ShootCalendar shoots={list} today={today} onOpen={setSel} />}
          {st.shoots.length > 0 && view === "Timeline" && <Timeline shoots={list} today={today} onOpen={setSel} />}
        </div>
        {selected && <aside className="cc-vside"><ShootDetail key={selected.id} s={selected} today={today} onClose={() => setSel(null)} /></aside>}
      </div>

      <StatusConfig open={cfg} onClose={() => setCfg(false)} />
    </div>
  );
}

function ShootCard({ s, today, on, onOpen }: { s: Shoot; today: string; on: boolean; onOpen: () => void }) {
  const r = readiness(s);
  return (
    <div className="cc-card" draggable data-selected={on} onDragStart={(e) => e.dataTransfer.setData("text/shoot", s.id)} onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <b>{s.title}</b>
      <div className="cc-meta" style={{ flexWrap: "wrap", marginBottom: 6 }}>
        {s.client && <span>{s.client}</span>}{s.shootDate && <span className={s.shootDate < today && s.status !== "Shot" ? "late" : ""}>{fmtDay(s.shootDate, today)}{s.shootTime ? ` ${s.shootTime}` : ""}</span>}
        {s.location && <span>{s.location}</span>}<Prio p={s.priority} />
      </div>
      <div className="cc-bar" title={r.ready ? "Ready" : `Missing: ${r.missing.join(", ")}`}><i style={{ width: `${r.pct}%` }} /></div>
    </div>
  );
}

function ShootCalendar({ shoots, today, onOpen }: { shoots: Shoot[]; today: string; onOpen: (id: string) => void }) {
  const [anchor, setAnchor] = useState(today.slice(0, 7));
  const [y, m] = anchor.split("-").map(Number);
  const first = `${anchor}-01`;
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const entries = calendarEntries(shoots);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); };
  return (
    <Panel title={`${MONTH_NAMES[m - 1]} ${y}`} actions={<><button className="cc-btn sm" onClick={() => shift(-1)}>←</button><button className="cc-btn sm" onClick={() => setAnchor(today.slice(0, 7))}>Today</button><button className="cc-btn sm" onClick={() => shift(1)}>→</button></>}>
      <div className="cc-cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="dow">{d}</div>)}
        {days.map((d) => (
          <div key={d} className={`${d === today ? "today" : ""} ${d.slice(0, 7) !== anchor ? "dim" : ""}`}>
            <div className="d">{Number(d.slice(8))}</div>
            {entries.filter((e) => e.date === d).map((e, i) => <button key={i} className={`cc-ev ${e.kind === "publish" ? "pub" : ""}`} onClick={() => onOpen(e.shootId)} title={`${e.kind}: ${e.title}`}>{e.kind === "publish" ? "▲ " : ""}{e.time ? e.time + " " : ""}{e.title}</button>)}
          </div>
        ))}
      </div>
      <div className="cc-meta cc-legend"><span><i className="dot shoot" />Shoot</span><span><i className="dot publish" />Publish deadline</span></div>
    </Panel>
  );
}

function Timeline({ shoots, today, onOpen }: { shoots: Shoot[]; today: string; onOpen: (id: string) => void }) {
  const from = addDays(today, -7), span = 63;
  const pos = (d: string) => Math.max(0, Math.min(100, (diffDays(d, from) / span) * 100));
  const groups = new Map<string, Shoot[]>();
  shoots.filter((s) => s.shootDate || s.publishDeadline).forEach((s) => { const k = s.campaign || s.client || s.brand || "No campaign"; groups.set(k, [...(groups.get(k) ?? []), s]); });
  if (!groups.size) return <Panel title="Timeline"><Empty title="No dated records" hint="Give a shoot a shoot date or publish deadline to see it here." /></Panel>;
  return (
    <Panel title="Timeline" count="9 weeks">
      <div style={{ padding: "6px 14px 14px", overflowX: "auto" }}>
        <div style={{ minWidth: 640, position: "relative" }}>
          <div style={{ position: "absolute", left: `${pos(today)}%`, top: 0, bottom: 0, width: 1, background: "var(--accent)", opacity: .6 }} aria-hidden />
          {Array.from(groups.entries()).map(([k, items]) => (
            <div key={k}>
              <div className="cc-grp" style={{ padding: "12px 0 4px" }}><b>{k}</b></div>
              {items.map((s) => (
                <div key={s.id} style={{ position: "relative", height: 26 }}>
                  {s.shootDate && s.publishDeadline && <div style={{ position: "absolute", top: 12, height: 2, background: "var(--line-strong)", left: `${pos(s.shootDate)}%`, width: `${Math.max(0, pos(s.publishDeadline) - pos(s.shootDate))}%` }} />}
                  {s.shootDate && <button className="cc-ev" style={{ position: "absolute", left: `${pos(s.shootDate)}%`, width: "auto", maxWidth: 200 }} onClick={() => onOpen(s.id)}>{s.title}</button>}
                  {s.publishDeadline && <button className="cc-ev pub" style={{ position: "absolute", left: `${pos(s.publishDeadline)}%`, width: "auto" }} onClick={() => onOpen(s.id)} title="Publish deadline">▲</button>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function isImg(u: string) { return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u); }
function isVid(u: string) { return /\.(mp4|webm|mov)(\?|$)/i.test(u); }

function ShootDetail({ s, today, onClose }: { s: Shoot; today: string; onClose: () => void }) {
  const st = useShoots();
  const tasks = useTasks();
  const prefs = usePrefs();
  const { rows } = useDeliverables();
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState({ label: "", url: "" });
  const [asset, setAsset] = useState({ label: "", url: "" });
  const [item, setItem] = useState("");
  const set = (p: Partial<Shoot>) => st.update(s.id, p);
  const r = readiness(s);
  const linked = tasks.tasks.filter((t) => t.shootId === s.id);
  const dl = rows.find((x) => x.id === s.deliverableId);
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="cc-field"><label className="cc-label">{label}</label>{children}</div>;
  const txt = (k: keyof Shoot, label: string) => <F label={label}><input className="cc-input" placeholder="Empty" value={(s[k] as string) ?? ""} onChange={(e) => set({ [k]: e.target.value || undefined } as Partial<Shoot>)} /></F>;

  const genBrief = async () => {
    if (!window.confirm("Send this record's title, client, brand, platform, script and notes to Gemini to draft a brief? Google's free tier may use submitted data to improve its products.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cc/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "brief", consent: true,
        context: { title: s.title, client: s.client, brand: s.brand, campaign: s.campaign, platform: s.platform, format: s.format, location: s.location, shootDate: s.shootDate, script: s.script?.slice(0, 4000), requirements: s.requirements, notes: s.notes } }) });
      const j = await res.json();
      if (!res.ok) { toast(j.error === "not_configured" ? "Gemini not configured (set GEMINI_API_KEY)" : j.error === "rate_limited" ? "Gemini rate limit — try again shortly" : "AI request failed", { tone: "err" }); return; }
      if (s.brief && !window.confirm("Replace the existing brief with the generated draft?")) return;
      set({ brief: j.text }); toast("Brief drafted — review before use");
    } finally { setBusy(false); }
  };

  return (
    <Panel title="Production record" actions={<button className="cc-iconbtn" onClick={onClose} aria-label="Close"><X /></button>}>
      <div style={{ padding: 14 }}>
        <input className="cc-input" style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }} value={s.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {s.status !== "Shot" && <button className="cc-btn sm" onClick={() => { st.move(s.id, "Shot"); prefs.log(`Marked shot: ${s.title}`, `/to-shoot?open=${s.id}`); }}><Camera />Mark shot</button>}
          <button className="cc-btn sm" onClick={genBrief} disabled={busy}><Sparkles />{busy ? "Drafting…" : "Generate brief"}</button>
          <button className="cc-btn sm" onClick={() => { const t = newTask({ title: `Prep: ${s.title}`, plannedDate: s.shootDate ? addDays(s.shootDate, -1) : today, due: s.shootDate, shootId: s.id, source: "shoot" }); tasks.add(t); set({ taskIds: [...s.taskIds, t.id] }); toast("Prep task added"); }}><Plus />Add task</button>
          <button className="cc-btn sm danger" onClick={() => { const x = st.remove(s.id); onClose(); if (x) toast("Record deleted", { undo: () => st.restore(x) }); }}><Trash2 />Delete</button>
        </div>
        <div className="cc-bar" style={{ marginBottom: 6 }}><i style={{ width: `${r.pct}%` }} /></div>
        <div className="cc-faint" style={{ marginBottom: 14, fontSize: 12 }}>{r.ready ? "Ready to shoot" : `Missing: ${r.missing.join(" · ")}`}</div>

        <div className="cc-row2">
          <F label="Stage"><select className="cc-select" value={s.status} onChange={(e) => st.move(s.id, e.target.value)}>{Array.from(new Set([...st.statuses, s.status])).map((x) => <option key={x}>{x}</option>)}</select></F>
          <F label="Priority"><select className="cc-select" value={s.priority} onChange={(e) => set({ priority: Number(e.target.value) as 0 })}><option value={0}>None</option><option value={1}>Low</option><option value={2}>Medium</option><option value={3}>High</option></select></F>
        </div>
        <div className="cc-row2"><F label="Shoot date"><input type="date" className="cc-input" value={s.shootDate ?? ""} onChange={(e) => set({ shootDate: e.target.value || undefined })} /></F>
          <F label="Shoot time"><input type="time" className="cc-input" value={s.shootTime ?? ""} onChange={(e) => set({ shootTime: e.target.value || undefined })} /></F></div>
        <F label="Publishing deadline"><input type="date" className="cc-input" value={s.publishDeadline ?? ""} onChange={(e) => set({ publishDeadline: e.target.value || undefined })} /></F>
        <div className="cc-row2">{txt("client", "Client")}{txt("brand", "Brand")}</div>
        <div className="cc-row2">{txt("campaign", "Campaign")}{txt("platform", "Platform")}</div>
        <div className="cc-row2">{txt("format", "Format")}{txt("category", "Category")}</div>
        <div className="cc-row2">{txt("location", "Location")}{txt("talent", "Host / talent")}</div>
        <div className="cc-row2">{txt("poc", "Point of contact")}{txt("owner", "Owner")}</div>

        <F label="Linked deliverable (owned by the sheet)"><select className="cc-select" value={s.deliverableId ?? ""} onChange={(e) => set({ deliverableId: e.target.value || undefined })}>
          <option value="">None</option>{rows.slice(0, 400).map((x) => <option key={x.id} value={x.id}>{x.pnNo} · {x.brand}</option>)}</select></F>
        {dl && <div className="cc-meta" style={{ marginBottom: 12 }}><span className="cc-badge">{dl.overallStatus}</span><span>{dl.deliverables.filter((d) => d.status === "Completed").length}/{dl.deliverables.length} items</span><Link href="/deliverables" className="cc-btn sm ghost">Open deliverable <ExternalLink /></Link></div>}

        <F label="Brief"><textarea className="cc-textarea" style={{ minHeight: 110 }} value={s.brief ?? ""} onChange={(e) => set({ brief: e.target.value || undefined })} /></F>
        <F label="Script"><textarea className="cc-textarea" value={s.script ?? ""} onChange={(e) => set({ script: e.target.value || undefined })} /></F>
        <F label="Production requirements"><textarea className="cc-textarea" style={{ minHeight: 50 }} value={s.requirements ?? ""} onChange={(e) => set({ requirements: e.target.value || undefined })} /></F>
        <F label="Special instructions"><textarea className="cc-textarea" style={{ minHeight: 50 }} value={s.instructions ?? ""} onChange={(e) => set({ instructions: e.target.value || undefined })} /></F>

        <div className="cc-label">Checklist</div>
        {(["prep", "gear", "post"] as const).map((g) => (
          <div key={g} style={{ marginBottom: 8 }}>
            <div className="cc-faint" style={{ fontSize: 11, textTransform: "uppercase", margin: "6px 0 2px" }}>{g}</div>
            {s.checklist.filter((c) => c.group === g).map((c) => (
              <label key={c.id} className="cc-item" style={{ padding: "3px 0", minHeight: 28, gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={c.done} style={{ accentColor: "var(--accent)" }} onChange={() => set({ checklist: s.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
                <span className="t" style={{ cursor: "pointer", textDecoration: c.done ? "line-through" : "none", color: c.done ? "var(--tx3)" : undefined }}>{c.text}</span>
              </label>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input className="cc-input" placeholder="Add checklist item" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { set({ checklist: [...s.checklist, { id: `${s.id}_${Date.now()}`, text: item.trim(), done: false, group: "prep" }] }); setItem(""); } }} />
        </div>

        <LinkList title="References" items={s.references} draft={ref} setDraft={setRef} onAdd={() => { set({ references: [...s.references, ref] }); setRef({ label: "", url: "" }); }} onRemove={(i) => set({ references: s.references.filter((_, j) => j !== i) })} />
        <LinkList title="Assets" items={s.assets} draft={asset} setDraft={setAsset} preview onAdd={() => { set({ assets: [...s.assets, asset] }); setAsset({ label: "", url: "" }); }} onRemove={(i) => set({ assets: s.assets.filter((_, j) => j !== i) })} />

        <F label="Notes"><textarea className="cc-textarea" value={s.notes ?? ""} onChange={(e) => set({ notes: e.target.value || undefined })} /></F>
        <div className="cc-label">Linked tasks</div>
        {linked.length === 0 ? <div className="cc-faint" style={{ marginBottom: 10 }}>None</div> : linked.map((t) => <div key={t.id} className="cc-item" style={{ padding: "2px 0" }}><Check size={12} style={{ opacity: t.status === "done" ? 1 : .2 }} /><Link className="t" href={`/tasks?open=${t.id}`}>{t.title}</Link></div>)}
        <div className="cc-label" style={{ marginTop: 14 }}>History</div>
        <div className="cc-faint" style={{ fontSize: 12 }}>{[...s.history].reverse().slice(0, 8).map((h, i) => <div key={i}>{new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} — {h.text}</div>)}</div>
      </div>
    </Panel>
  );
}

function LinkList({ title, items, draft, setDraft, onAdd, onRemove, preview }: { title: string; items: { label: string; url: string }[]; draft: { label: string; url: string }; setDraft: (d: { label: string; url: string }) => void; onAdd: () => void; onRemove: (i: number) => void; preview?: boolean }) {
  const safe = (u: string) => /^https?:\/\//i.test(u);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="cc-label">{title}</div>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div className="cc-item" style={{ padding: "2px 0", minHeight: 26 }}>
            {safe(it.url) ? <a className="t" href={it.url} target="_blank" rel="noopener noreferrer">{it.label || it.url}</a> : <span className="t">{it.label || it.url}</span>}
            <button className="cc-iconbtn" onClick={() => onRemove(i)} aria-label={`Remove ${it.label || it.url}`}><X /></button>
          </div>
          {preview && safe(it.url) && isImg(it.url) && <img src={it.url} alt={it.label} loading="lazy" style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid var(--line)" }} />}
          {preview && safe(it.url) && isVid(it.url) && <video src={it.url} controls preload="metadata" style={{ maxWidth: "100%", borderRadius: 6 }} />}
        </div>
      ))}
      <div className="cc-row2" style={{ gridTemplateColumns: "1fr 1.4fr auto" }}>
        <input className="cc-input" placeholder="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <input className="cc-input" placeholder="https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        <button className="cc-btn" disabled={!safe(draft.url)} onClick={onAdd}>Add</button>
      </div>
    </div>
  );
}

function StatusConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { statuses, setStatuses } = useShoots();
  const [text, setText] = useState("");
  useEffect(() => { if (open) setText(statuses.join("\n")); }, [open, statuses]);
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Production stages">
      <p className="cc-muted" style={{ marginTop: 0 }}>One stage per line, in board order. Records on a removed stage stay visible in their own column.</p>
      <textarea className="cc-textarea" style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="Stages" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button className="cc-btn ghost" onClick={onClose}>Cancel</button>
        <button className="cc-btn primary" onClick={() => { const l = Array.from(new Set(text.split("\n").map((x) => x.trim()).filter(Boolean))); if (l.length) { setStatuses(l); onClose(); } }}>Save</button>
      </div>
    </Modal>
  );
}
