"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, startOfWeek } from "../lib/planner";
import { useShoots, useTasks } from "../store/stores";
import { ConnBanner, Panel, Skeleton, fmtLong } from "./ui";
import { useConnector, useNow } from "./data";

export interface CalEvent { id: string; title: string; start?: string; end?: string; allDay: boolean; meeting: boolean; location?: string; link?: string }
const RANGES = ["Today", "Week", "Upcoming"] as const;
const hhmm = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "";
const dayOf = (iso?: string) => iso ? (iso.length === 10 ? iso : new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) : "";

export function useAgenda(from: string, to: string) {
  return useConnector<{ conn?: string; detail?: string; events?: CalEvent[] }>(`/api/cc/calendar?from=${from}&to=${to}`);
}

export function Agenda() {
  const { today } = useNow();
  const [range, setRange] = useState<(typeof RANGES)[number]>("Week");
  const from = range === "Week" ? startOfWeek(today) : today;
  const to = range === "Today" ? today : range === "Week" ? addDays(startOfWeek(today), 6) : addDays(today, 14);
  const { data, loading } = useAgenda(from, to);
  const shoots = useShoots((s) => s.shoots);
  const tasks = useTasks((s) => s.tasks);

  const days = useMemo(() => {
    const out: { d: string; items: { t: string; time: string; title: string; kind: "cal" | "shoot" | "publish" | "task" | "deadline"; href?: string; meeting?: boolean }[] }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const items: (typeof out)[number]["items"] = [];
      (data?.events ?? []).filter((e) => dayOf(e.start) === d).forEach((e) => items.push({ t: e.allDay ? "00:00" : hhmm(e.start), time: e.allDay ? "all day" : `${hhmm(e.start)}–${hhmm(e.end)}`, title: e.title, kind: "cal", href: e.link, meeting: e.meeting }));
      shoots.filter((s) => s.shootDate === d).forEach((s) => items.push({ t: s.shootTime ?? "00:01", time: s.shootTime ?? "shoot", title: s.title, kind: "shoot", href: `/to-shoot?open=${s.id}` }));
      shoots.filter((s) => s.publishDeadline === d).forEach((s) => items.push({ t: "23:58", time: "publish", title: s.title, kind: "publish", href: `/to-shoot?open=${s.id}` }));
      tasks.filter((t) => t.status !== "done" && t.status !== "dropped" && t.plannedDate === d && t.plannedStart).forEach((t) => items.push({ t: t.plannedStart!, time: `${t.plannedStart}${t.durationMin ? ` · ${t.durationMin}m` : ""}`, title: t.title, kind: "task", href: `/tasks?open=${t.id}` }));
      tasks.filter((t) => t.status !== "done" && t.status !== "dropped" && t.due === d).forEach((t) => items.push({ t: "23:59", time: "deadline", title: t.title, kind: "deadline", href: `/tasks?open=${t.id}` }));
      out.push({ d, items: items.sort((a, b) => a.t.localeCompare(b.t)) });
    }
    return out;
  }, [data, shoots, tasks, from, to]);

  const color = { cal: "var(--info)", shoot: "var(--accent)", publish: "var(--ai)", task: "var(--tx2)", deadline: "var(--warn)" } as const;
  return (
    <div className="cc-page">
      <div className="cc-pagehead"><h2>Calendar</h2><span className="sub">Asia/Kolkata · read-only Google Calendar + shoots + deadlines</span><div className="cc-spacer" />
        <div className="cc-tabs" role="tablist">{RANGES.map((r) => <button key={r} role="tab" className="cc-tab" aria-selected={range === r} onClick={() => setRange(r)}>{r}</button>)}</div></div>
      <ConnBanner conn={data?.conn} what="Google Calendar" detail={data?.detail} />
      {loading && !data ? <Skeleton rows={6} /> : (
        <div style={{ display: "grid", gap: 12 }}>
          {days.filter((x) => x.items.length || range !== "Upcoming").map(({ d, items }) => (
            <Panel key={d} title={fmtLong(d)} count={d === today ? "Today" : items.length ? items.length : ""}>
              {items.length === 0 ? <div className="cc-faint" style={{ padding: "10px 14px" }}>Free</div> : items.map((it, i) => (
                <div key={i} className="cc-item"><span style={{ width: 3, alignSelf: "stretch", background: color[it.kind], borderRadius: 2 }} />
                  <span className="cc-mono cc-faint" style={{ width: 86 }}>{it.time}</span>
                  {it.href ? (it.href.startsWith("http") ? <a className="t" href={it.href} target="_blank" rel="noopener noreferrer">{it.title}</a> : <Link className="t" href={it.href}>{it.title}</Link>) : <span className="t">{it.title}</span>}
                  <span className="cc-badge">{it.kind === "cal" ? (it.meeting ? "meeting" : "event") : it.kind}</span></div>))}
            </Panel>))}
        </div>
      )}
    </div>
  );
}
