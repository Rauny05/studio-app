"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock, CheckCheck, Clock, MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react";
import { useShoots, usePrefs, useTasks } from "../store/stores";
import { addDays, bucketOf, newTask, parseQuickCapture, plannedLoad, sortTasks, startOfWeek, type Recurrence, type Task } from "../lib/planner";
import { fuzzyScore } from "../lib/fuzzy";
import { CheckBox, Menu, Prio, Panel, fmtDay, toast } from "./ui";
import { useDeliverables, useNow } from "./data";
import { useTodoStore } from "@/store/todo-store";

const VIEWS = [
  ["today", "Today"], ["upcoming", "Upcoming"], ["week", "This week"], ["overdue", "Overdue"], ["all", "All"],
  ["done", "Completed"], ["project", "By project"], ["priority", "By priority"],
] as const;
type View = (typeof VIEWS)[number][0];

interface Group { key: string; title: string; tasks: Task[]; warn?: boolean }

function groupTasks(all: Task[], view: View, today: string, q: string): Group[] {
  const list = all.filter((t) => !q || fuzzyScore(q, `${t.title} ${t.tags.join(" ")} ${t.project ?? ""}`) >= 0);
  const open = list.filter((t) => t.status !== "done" && t.status !== "dropped");
  const b = (t: Task) => bucketOf(t, today);
  const g = (key: string, title: string, tasks: Task[], warn?: boolean): Group => ({ key, title, tasks: sortTasks(tasks), warn });
  switch (view) {
    case "today": return [g("o", "Overdue", open.filter((t) => b(t) === "overdue"), true), g("t", "Today", open.filter((t) => b(t) === "today")),
      g("d", "Done today", list.filter((t) => t.status === "done" && t.completedAt?.slice(0, 10) === today))];
    case "upcoming": return [g("u", "Upcoming", open.filter((t) => b(t) === "upcoming")), g("n", "Unscheduled", open.filter((t) => b(t) === "unscheduled"))];
    case "week": return Array.from({ length: 7 }, (_, i) => { const d = addDays(startOfWeek(today), i); return g(d, fmtDay(d, today), open.filter((t) => (t.plannedDate ?? t.due) === d)); }).filter((x) => x.tasks.length || x.key >= today);
    case "overdue": return [g("o", "Overdue", open.filter((t) => b(t) === "overdue"), true)];
    case "done": return [g("d", "Completed", list.filter((t) => t.status === "done").sort((a, b2) => (b2.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 200))];
    case "project": {
      const m = new Map<string, Task[]>(); for (const t of open) m.set(t.project ?? "No project", [...(m.get(t.project ?? "No project") ?? []), t]);
      return Array.from(m.entries()).map(([k, v]) => g(k, k, v));
    }
    case "priority": return [3, 2, 1, 0].map((p) => g(`p${p}`, ["No priority", "Low", "Medium", "High"][p], open.filter((t) => t.priority === p)));
    default: return [g("o", "Overdue", open.filter((t) => b(t) === "overdue"), true), g("t", "Today", open.filter((t) => b(t) === "today")),
      g("u", "Upcoming", open.filter((t) => b(t) === "upcoming")), g("n", "Unscheduled", open.filter((t) => b(t) === "unscheduled"))];
  }
}

export function TasksWorkspace({ initialView }: { initialView: View }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { today } = useNow();
  const store = useTasks();
  const prefs = usePrefs();
  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState("");
  const [cap, setCap] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState(sp.get("plan") === "1");
  const capRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const o = sp.get("open"); if (o) setSel(o); }, [sp]);
  useEffect(() => { setView(initialView); }, [initialView]);

  const groups = useMemo(() => groupTasks(store.tasks, view, today, q), [store.tasks, view, today, q]);
  const flat = useMemo(() => groups.flatMap((x) => x.tasks), [groups]);
  const selected = store.tasks.find((t) => t.id === sel) ?? null;

  const doComplete = (t: Task) => {
    if (t.status === "done") { store.reopen(t.id); return; }
    store.complete(t.id); prefs.log(`Completed “${t.title}”`);
    toast(`Completed “${t.title.slice(0, 40)}”`, { undo: () => store.reopen(t.id) });
  };
  const doDelete = (t: Task) => { const r = store.remove(t.id); if (sel === t.id) setSel(null); if (r) toast("Task deleted", { undo: () => store.restore(r) }); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || e.metaKey || e.ctrlKey || document.querySelector('[role="dialog"]')) return;
      const cur = flat[focus];
      if (e.key === "j") { e.preventDefault(); setFocus((f) => Math.min(f + 1, flat.length - 1)); }
      else if (e.key === "k") { e.preventDefault(); setFocus((f) => Math.max(f - 1, 0)); }
      else if (e.key === "x" && cur) { e.preventDefault(); doComplete(cur); }
      else if (e.key === "Enter" && cur) { setSel(cur.id); }
      else if (e.key === "Backspace" && cur) { e.preventDefault(); doDelete(cur); }
      else if (e.key === "Escape") setSel(null);
      else if (e.key === "n") { e.preventDefault(); capRef.current?.focus(); }
      else if (cur && "0123".includes(e.key) && e.key.length === 1) { store.update(cur.id, { priority: Number(e.key) as 0 }); }
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  });

  const submitCap = () => {
    const p = parseQuickCapture(cap, today);
    if (!p.title) return;
    const base = view === "today" && !p.plannedDate && !p.due ? { plannedDate: today } : {};
    const t = newTask({ title: p.title, due: p.due, plannedDate: p.plannedDate, plannedStart: p.plannedStart, durationMin: p.durationMin, priority: p.priority, tags: p.tags, project: p.project, recurrence: p.recurrence, ...base });
    store.add(t); prefs.log(`Added task “${t.title}”`, `/tasks?open=${t.id}`); setCap("");
  };

  const onDrop = (date: string | undefined, id: string) => { store.reschedule(id, date); toast(date ? `Planned for ${fmtDay(date, today)}` : "Moved to unscheduled"); };

  const unfinished = store.tasks.filter((t) => t.status !== "done" && t.status !== "dropped" && bucketOf(t, today) === "overdue");

  const todayN = store.tasks.filter((t) => bucketOf(t, today) === "today").length;
  const overdueN = store.tasks.filter((t) => bucketOf(t, today) === "overdue").length;

  return (
    <div className="cc-view">
      <div className="cc-vbar">
        <div className="cc-vtabs" role="tablist">
          {VIEWS.map(([id, label]) => <button key={id} role="tab" className="cc-vtab" aria-selected={view === id} onClick={() => setView(id)}>{label}</button>)}
        </div>
        <span className="cc-spacer" />
        <span className="cc-vmeta cc-hide-m">{todayN} today{overdueN ? <> · <b className="late">{overdueN} overdue</b></> : null}</span>
        <label className="cc-searchfield sm"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter tasks" /></label>
        <button className="cc-btn sm" aria-pressed={plan} onClick={() => setPlan((p) => !p)}><CalendarClock /><span className="cc-hide-m">Plan my day</span></button>
      </div>
      <div className="cc-vbody">
        <div className="cc-vmain">
          <div className="cc-add pad">
            <Plus /><input ref={capRef} value={cap} onChange={(e) => setCap(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitCap()} placeholder="Add a task — “Edit reel tomorrow 3pm 90m !high #poco by friday”" aria-label="Quick add task" />
            {cap && <kbd>↵</kbd>}
          </div>

          {plan && (
            <section className="cc-plan">
              <header><b>Plan my day</b>
                <span className="cc-faint">{(() => { const l = plannedLoad(store.tasks, today); return `${l.items.length} planned · ${Math.round(l.scheduledMin / 6) / 10}h blocked${l.free ? "" : " · over 8h"}`; })()}</span>
                <span className="cc-spacer" /><button className="cc-iconbtn" onClick={() => setPlan(false)} aria-label="Close planning"><X /></button></header>
              {unfinished.length === 0 ? <p className="cc-faint">Nothing left over from earlier days.</p> : unfinished.map((t) => (
                <div key={t.id} className="cc-plan-row">
                  <span className="t" onClick={() => setSel(t.id)}>{t.title}</span>
                  <span className="late">{fmtDay(t.plannedDate ?? t.due, today)}</span>
                  <button className="cc-btn sm" onClick={() => store.reschedule(t.id, today)}>Today</button>
                  <button className="cc-btn sm" onClick={() => store.reschedule(t.id, addDays(today, 1))}>Tomorrow</button>
                  <button className="cc-btn sm ghost" onClick={() => store.update(t.id, { status: "dropped" })}>Drop</button>
                </div>
              ))}
              <div className="cc-plan-drop">Drag a task onto a day:
                {[0, 1, 2, 3].map((n) => { const d = addDays(today, n); return <span key={d} className="cc-chip" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(d, e.dataTransfer.getData("text/task"))}>{fmtDay(d, today)}</span>; })}
                <span className="cc-chip" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(undefined, e.dataTransfer.getData("text/task"))}>Unscheduled</span>
              </div>
            </section>
          )}

          {bulk.size > 0 && (
            <div className="cc-bulk">
              <b>{bulk.size} selected</b>
              <button className="cc-btn sm" onClick={() => { bulk.forEach((id) => store.complete(id)); toast(`${bulk.size} completed`); setBulk(new Set()); }}><CheckCheck />Complete</button>
              <button className="cc-btn sm" onClick={() => { bulk.forEach((id) => store.reschedule(id, today)); setBulk(new Set()); }}>Move to today</button>
              <button className="cc-btn sm danger" onClick={() => { const rm = Array.from(bulk).map((id) => store.remove(id)).filter(Boolean) as Task[]; setBulk(new Set()); toast(`${rm.length} deleted`, { undo: () => rm.forEach(store.restore) }); }}>Delete</button>
              <span className="cc-spacer" /><button className="cc-btn sm ghost" onClick={() => setBulk(new Set())}>Clear</button>
            </div>
          )}

          {flat.length === 0 && groups.every((x) => !x.tasks.length) && <div className="cc-vempty"><b>{q ? "No matches" : view === "today" ? "Your day is clear" : "Nothing here"}</b><span>{q ? "Try a different filter." : "Type above to add a task."}</span></div>}
          <div className="cc-list" role="list">
            {groups.map((gr) => gr.tasks.length === 0 ? null : (
              <div key={gr.key}>
                <div className={`cc-grp ${gr.warn ? "warn" : ""}`}><b>{gr.title}</b><span>{gr.tasks.length}</span></div>
                {gr.tasks.map((t) => {
                  const idx = flat.indexOf(t);
                  return (
                    <div key={t.id} role="listitem" className={`cc-item ${t.status === "done" ? "done" : ""}`} data-selected={sel === t.id} data-focus={focus === idx}
                      draggable onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)} onClick={() => setFocus(idx)}>
                      <input type="checkbox" className="cc-sel cc-hide-m" aria-label={`Select ${t.title}`} checked={bulk.has(t.id)} onChange={(e) => setBulk((s) => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })} />
                      <CheckBox on={t.status === "done"} onClick={() => doComplete(t)} label={t.status === "done" ? "Reopen" : "Complete"} />
                      <span className="t" onClick={() => setSel(t.id)}>{t.title}</span>
                      <span className="cc-meta">
                        {t.tags.slice(0, 2).map((x) => <span key={x} className="cc-tag cc-hide-m">{x}</span>)}
                        {t.recurrence !== "none" && <span title={`Repeats ${t.recurrence}`}>↻</span>}
                        {t.plannedStart && <span><Clock size={11} style={{ verticalAlign: -1 }} /> {t.plannedStart}{t.durationMin ? ` · ${t.durationMin}m` : ""}</span>}
                        {t.due && <span className={t.due < today && t.status !== "done" ? "late" : t.due === today ? "soon" : ""}>due {fmtDay(t.due, today)}</span>}
                        {!t.due && t.plannedDate && !t.plannedStart && <span>{fmtDay(t.plannedDate, today)}</span>}
                        <Prio p={t.priority} />
                      </span>
                      <span className="cc-hover-act">
                        <Menu label="Task actions" trigger={<MoreHorizontal />} items={[
                          { label: "Plan for today", onSelect: () => store.reschedule(t.id, today) },
                          { label: "Plan for tomorrow", onSelect: () => store.reschedule(t.id, addDays(today, 1)) },
                          { label: "Unschedule", onSelect: () => store.reschedule(t.id, undefined) },
                          { sep: true, label: "", onSelect: () => {} },
                          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => doDelete(t) },
                        ]} />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <LegacyTodos />
          <div className="cc-keys cc-hide-m"><span><kbd>J</kbd><kbd>K</kbd> move</span><span><kbd>X</kbd> done</span><span><kbd>↵</kbd> open</span><span><kbd>0–3</kbd> priority</span><span><kbd>⌫</kbd> delete</span></div>
        </div>
        {selected && <aside className="cc-vside"><TaskDetail key={selected.id} task={selected} today={today} onClose={() => { setSel(null); router.replace(window.location.pathname); }} /></aside>}
      </div>
    </div>
  );
}

function LegacyTodos() {
  const todos = useTodoStore((s) => s.todos);
  useEffect(() => { void useTodoStore.persist.rehydrate(); }, []);
  const open = todos.filter((t) => !t.completed);
  if (!open.length) return null;
  return (
    <div>
      <div className="cc-grp"><b>Legacy todos</b><span>{open.length}</span><span className="cc-spacer" /><Link href="/todos" className="cc-hs-link">Read-only · open Todos <ArrowRight /></Link></div>
      {open.slice(0, 6).map((t) => <div key={t.id} className="cc-item"><span className="t cc-muted">{t.title}</span></div>)}
    </div>
  );
}

function TaskDetail({ task: t, today, onClose }: { task: Task; today: string; onClose: () => void }) {
  const store = useTasks();
  const shoots = useShoots((s) => s.shoots);
  const { rows } = useDeliverables();
  const [title, setTitle] = useState(t.title);
  const set = (p: Partial<Task>) => store.update(t.id, p);
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="cc-field"><label className="cc-label">{label}</label>{children}</div>;
  return (
    <Panel title="Task" actions={<button className="cc-iconbtn" onClick={onClose} aria-label="Close details"><X /></button>}>
      <div style={{ padding: 14 }}>
        <input className="cc-input" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== t.title && set({ title: title.trim() })} aria-label="Title" />
        <div className="cc-row2">
          <F label="Status"><select className="cc-select" value={t.status} onChange={(e) => (e.target.value === "done" ? store.complete(t.id) : set({ status: e.target.value as Task["status"], completedAt: undefined }))}>
            <option value="todo">To do</option><option value="doing">In progress</option><option value="done">Done</option><option value="dropped">Dropped</option></select></F>
          <F label="Priority"><select className="cc-select" value={t.priority} onChange={(e) => set({ priority: Number(e.target.value) as 0 })}><option value={0}>None</option><option value={1}>Low</option><option value={2}>Medium</option><option value={3}>High</option></select></F>
        </div>
        <div className="cc-row2">
          <F label="Deadline"><input type="date" className="cc-input" value={t.due ?? ""} onChange={(e) => set({ due: e.target.value || undefined })} /></F>
          <F label="Work on"><input type="date" className="cc-input" value={t.plannedDate ?? ""} onChange={(e) => set({ plannedDate: e.target.value || undefined })} /></F>
        </div>
        <div className="cc-row2">
          <F label="Start time"><input type="time" className="cc-input" value={t.plannedStart ?? ""} onChange={(e) => set({ plannedStart: e.target.value || undefined, plannedDate: t.plannedDate ?? today })} /></F>
          <F label="Duration (min)"><input type="number" min={0} step={5} className="cc-input" value={t.durationMin ?? ""} onChange={(e) => set({ durationMin: e.target.value ? Number(e.target.value) : undefined })} /></F>
        </div>
        <F label="Repeats"><select className="cc-select" value={t.recurrence} onChange={(e) => set({ recurrence: e.target.value as Recurrence })}>
          <option value="none">Never</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></F>
        <div className="cc-row2">
          <F label="Project"><input className="cc-input" placeholder="Empty" value={t.project ?? ""} onChange={(e) => set({ project: e.target.value || undefined })} /></F>
          <F label="Client"><input className="cc-input" placeholder="Empty" value={t.client ?? ""} onChange={(e) => set({ client: e.target.value || undefined })} /></F>
        </div>
        <F label="Linked deliverable"><select className="cc-select" value={t.deliverableId ?? ""} onChange={(e) => set({ deliverableId: e.target.value || undefined })}>
          <option value="">None</option>{rows.slice(0, 400).map((r) => <option key={r.id} value={r.id}>{r.pnNo} · {r.brand}</option>)}</select></F>
        <F label="Linked shoot"><select className="cc-select" value={t.shootId ?? ""} onChange={(e) => set({ shootId: e.target.value || undefined })}>
          <option value="">None</option>{shoots.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></F>
        <F label="Tags"><input className="cc-input" placeholder="Empty" value={t.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></F>
        <F label="Notes"><textarea className="cc-textarea" value={t.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></F>
        {t.sourceRef && t.source === "gmail" && <a className="cc-btn sm" href={`https://mail.google.com/mail/u/0/#all/${t.sourceRef}`} target="_blank" rel="noopener noreferrer">Open Gmail thread</a>}
        <div className="cc-label" style={{ marginTop: 14 }}>History</div>
        <div className="cc-faint" style={{ fontSize: 12 }}>
          {[...t.history].reverse().slice(0, 8).map((h, i) => <div key={i}>{new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} — {h.text}</div>)}
        </div>
      </div>
    </Panel>
  );
}
