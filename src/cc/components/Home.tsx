"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, MoreHorizontal, Plus, Sparkles } from "lucide-react";
import { ALL_WIDGETS, useApps, usePrefs, useShoots, useTasks, type WidgetId } from "../store/stores";
import { addDays, bucketOf, diffDays, newTask, parseQuickCapture, sortTasks } from "../lib/planner";
import { readiness } from "../lib/shoots";
import { appHref } from "../apps/adapter";
import { CheckBox, Menu, Prio, Skeleton, fmtDay, toast } from "./ui";
import { useAppRegistry, useConnector, useDeliverables, useHealth, useNow } from "./data";
import { useAgenda, type CalEvent } from "./Agenda";
import type { Thread } from "./Inbox";
import { AppIcon } from "./AppIcon";
import { useAIContext } from "./StudioAI";

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const longDate = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

interface Item { date: string; time: string; label: string; kind: "event" | "shoot" | "task" | "publish"; href?: string }

/** Section heading used across Home: title, optional count, one quiet link. No box. */
function Section({ title, count, href, linkLabel, aside, children }: { title: string; count?: number; href?: string; linkLabel?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cc-hs">
      <header className="cc-hs-hd">
        <h2>{title}</h2>{count ? <span className="n">{count}</span> : null}
        <span className="cc-spacer" />{aside}
        {href && <Link href={href} className="cc-hs-link">{linkLabel ?? "View all"}<ArrowRight /></Link>}
      </header>
      {children}
    </section>
  );
}
/** One-line connection hint; replaces the warning banners on Home. */
function NotConnected({ what }: { what: string }) {
  return <Link href="/integrations" className="cc-hs-note">{what} not connected</Link>;
}

export function Home() {
  const { today, time } = useNow();
  const tasks = useTasks();
  const shoots = useShoots((s) => s.shoots);
  const prefs = usePrefs();
  const { rows, loading: dlLoading } = useDeliverables();
  const cal = useAgenda(today, addDays(today, 6));
  const mail = useConnector<{ conn?: string; detail?: string; threads?: Thread[] }>("/api/cc/gmail?view=important");
  const [cap, setCap] = useState("");

  const open = tasks.tasks.filter((t) => t.status !== "done" && t.status !== "dropped");
  const overdue = open.filter((t) => bucketOf(t, today) === "overdue");
  const dueToday = open.filter((t) => bucketOf(t, today) === "today");
  const dayTasks = useMemo(() => [...sortTasks(overdue), ...sortTasks(dueToday)], [overdue, dueToday]);
  const weekShoots = shoots.filter((s) => s.shootDate && s.shootDate >= today && diffDays(s.shootDate, today) <= 6 && !["Shot", "Published"].includes(s.status));
  const inReview = shoots.filter((s) => ["Internal Review", "Client Review"].includes(s.status));
  const active = rows.filter((r) => r.overallStatus === "pending" || r.overallStatus === "in-progress");
  const awaitingPay = rows.filter((r) => r.overallStatus === "awaiting-payment");
  const goLive = rows.filter((r) => r.overallStatus !== "done" && r.goLiveDate && r.goLiveDate >= today && diffDays(r.goLiveDate, today) <= 14);

  const upcoming = useMemo(() => {
    const out: Item[] = [];
    (cal.data?.events ?? []).forEach((e: CalEvent) => out.push({ date: e.allDay ? e.start!.slice(0, 10) : istDate(e.start!), time: e.allDay ? "" : istTime(e.start!), label: e.title, kind: "event" }));
    shoots.forEach((s) => {
      if (s.shootDate && s.shootDate > today && s.shootDate <= addDays(today, 6) && !["Shot", "Published"].includes(s.status)) out.push({ date: s.shootDate, time: s.shootTime ?? "", label: s.title, kind: "shoot", href: `/to-shoot?open=${s.id}` });
      if (s.publishDeadline && s.publishDeadline > today && s.publishDeadline <= addDays(today, 6) && s.status !== "Published") out.push({ date: s.publishDeadline, time: "", label: `Publish ${s.title}`, kind: "publish", href: `/to-shoot?open=${s.id}` });
    });
    open.forEach((t) => {
      if (t.plannedDate && t.plannedDate > today && t.plannedDate <= addDays(today, 6)) out.push({ date: t.plannedDate, time: t.plannedStart ?? "", label: t.title, kind: "task", href: `/tasks?open=${t.id}` });
      else if (t.due && t.due > today && t.due <= addDays(today, 6)) out.push({ date: t.due, time: "", label: `${t.title} due`, kind: "task", href: `/tasks?open=${t.id}` });
    });
    out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99").localeCompare(b.time || "99"));
    const days: { date: string; items: Item[] }[] = [];
    for (const it of out) { const d = days[days.length - 1]; if (d?.date === it.date) d.items.push(it); else days.push({ date: it.date, items: [it] }); }
    return days;
  }, [cal.data, shoots, open, today]);

  const done = (id: string, title: string) => { tasks.complete(id); prefs.log(`Completed “${title}”`); toast("Completed", { undo: () => tasks.reopen(id) }); };
  const quickAdd = () => {
    const p = parseQuickCapture(cap, today); if (!p.title) return;
    tasks.add(newTask({ title: p.title, due: p.due, plannedDate: p.plannedDate ?? (p.due ? undefined : today), plannedStart: p.plannedStart, durationMin: p.durationMin, priority: p.priority, tags: p.tags, project: p.project, recurrence: p.recurrence }));
    prefs.log(`Added task “${p.title}”`); setCap("");
  };

  // One sentence that says what matters, built only from real data.
  const summary = (() => {
    const parts: string[] = [];
    if (overdue.length) parts.push(`${plural(overdue.length, "overdue task")}`);
    parts.push(dueToday.length ? `${plural(dueToday.length, "task")} today` : overdue.length ? "nothing else planned today" : "a clear day");
    if (weekShoots.length) parts.push(`${plural(weekShoots.length, "shoot")} this week`);
    if (awaitingPay.length) parts.push(`${awaitingPay.length} deliverables awaiting payment`);
    const s = parts.join(", ").replace(/, ([^,]*)$/, " and $1");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  })();

  const vis = (id: WidgetId) => !prefs.widgetHidden.includes(id);
  const sections: Record<WidgetId, React.ReactNode> = {
    myday: (
      <Section key="myday" title="Today" count={dayTasks.length} href="/my-day" linkLabel="My Day">
        <div className="cc-add">
          <Plus /><input value={cap} onChange={(e) => setCap(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} placeholder="Add a task — try “Edit reel tomorrow 4pm !high”" aria-label="Add a task" />
          {cap && <kbd>↵</kbd>}
        </div>
        {dayTasks.length === 0 ? <p className="cc-hs-empty">Nothing overdue or planned for today.</p> : (
          <div className="cc-hl">{dayTasks.slice(0, 8).map((t) => {
            const late = bucketOf(t, today) === "overdue";
            return (
              <div key={t.id} className="cc-hl-row">
                <CheckBox on={false} onClick={() => done(t.id, t.title)} label={`Complete ${t.title}`} />
                <Link className="t" href={`/tasks?open=${t.id}`}>{t.title}</Link>
                <span className="cc-meta">
                  {late ? <span className="late">{fmtDay(t.due ?? t.plannedDate, today)}</span> : t.plannedStart && <span>{t.plannedStart}{t.durationMin ? ` · ${t.durationMin}m` : ""}</span>}
                  <Prio p={t.priority} />
                </span>
              </div>
            );
          })}</div>
        )}
        {dayTasks.length > 8 && <Link href="/my-day" className="cc-hs-more">{dayTasks.length - 8} more</Link>}
      </Section>
    ),
    schedule: (
      <Section key="schedule" title="This week" href="/agenda" linkLabel="Calendar" aside={cal.data?.conn && cal.data.conn !== "ok" ? <NotConnected what="Calendar" /> : null}>
        {cal.loading && !cal.data ? <Skeleton rows={2} /> : upcoming.length === 0 ? <p className="cc-hs-empty">Nothing scheduled in the next six days.</p> : (
          <div className="cc-agenda">{upcoming.map((d) => (
            <div key={d.date} className="cc-agenda-day">
              <div className="cc-agenda-date"><b>{fmtDay(d.date, today)}</b><small>{longDate(d.date, { day: "numeric", month: "short" })}</small></div>
              <div className="cc-agenda-items">{d.items.map((it, i) => (
                <div key={i} className="cc-agenda-it">
                  <span className="cc-faint tm">{it.time || "—"}</span>
                  <i className={`dot ${it.kind}`} />
                  {it.href ? <Link className="t" href={it.href}>{it.label}</Link> : <span className="t">{it.label}</span>}
                </div>))}</div>
            </div>))}</div>
        )}
      </Section>
    ),
    production: (() => {
      const live = shoots.filter((s) => !["Published", "On Hold"].includes(s.status))
        .sort((a, b) => (a.shootDate ?? "9999").localeCompare(b.shootDate ?? "9999") || b.priority - a.priority).slice(0, 6);
      return (
        <Section key="production" title="To Shoot" count={live.length} href="/to-shoot" linkLabel="Board">
          {live.length === 0 ? <p className="cc-hs-empty">No shoots in production. Press C to add one.</p> : (
            <div className="cc-hl">{live.map((s) => {
              const r = readiness(s).pct;
              return (
                <Link key={s.id} href={`/to-shoot?open=${s.id}`} className="cc-hl-row shoot">
                  <span className="t"><b>{s.title}</b>{(s.brand || s.platform) && <small>{[s.brand, s.platform].filter(Boolean).join(" · ")}</small>}</span>
                  <span className="cc-status-tag">{s.status}</span>
                  <span className="cc-ready cc-hide-m" title={`${r}% prepped`}><span className="cc-bar"><i style={{ width: `${r}%` }} /></span><small>{r}%</small></span>
                  <span className="cc-faint when">{s.shootDate ? fmtDay(s.shootDate, today) : "No date"}</span>
                </Link>
              );
            })}</div>
          )}
        </Section>
      );
    })(),
    inbox: (
      <Section key="inbox" title="Email" href="/inbox" linkLabel="Inbox" aside={mail.data?.conn && mail.data.conn !== "ok" ? <NotConnected what="Gmail" /> : null}>
        {mail.loading && !mail.data ? <Skeleton rows={2} /> : mail.data?.conn === "ok" ? ((mail.data.threads ?? []).length === 0 ? <p className="cc-hs-empty">No important threads.</p> :
          <div className="cc-hl">{(mail.data.threads ?? []).slice(0, 4).map((t) => <Link key={t.id} href="/inbox" className="cc-mail"><b className={t.unread ? "u" : ""}>{t.from.replace(/<.*>/, "").replace(/"/g, "").trim()}</b><span>{t.subject}</span></Link>)}</div>)
          : <p className="cc-hs-empty">Connect Gmail to see threads that need a reply.</p>}
      </Section>
    ),
    pulse: (
      <Section key="pulse" title="Studio" href="/operations" linkLabel="Operations">
        {dlLoading && !rows.length ? <Skeleton rows={2} /> : (
          <div className="cc-figs">
            {([["Active", active.length, "/operations"], ["Awaiting payment", awaitingPay.length, "/operations"], ["Go-live · 14 days", goLive.length, "/operations"], ["In review", inReview.length, "/to-shoot"]] as const).map(([l, n, h]) => (
              <Link key={l} href={h} className="cc-fig"><b>{n}</b><span>{l}</span></Link>))}
          </div>
        )}
      </Section>
    ),
    apps: <AppsSection key="apps" />,
    briefing: <Briefing key="briefing" />,
    activity: (
      <Section key="activity" title="Activity">
        {prefs.activity.length === 0 ? <p className="cc-hs-empty">Changes you make will appear here.</p> :
          <ol className="cc-feed">{prefs.activity.slice(0, 5).map((a) => <li key={a.id}>{a.href ? <Link href={a.href}>{a.text}</Link> : <span>{a.text}</span>}<time>{new Date(a.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</time></li>)}</ol>}
      </Section>
    ),
  };

  const col = (c: "a" | "b" | "c") => ALL_WIDGETS.filter((w) => w.column === c && vis(w.id)).map((w) => sections[w.id]);
  const hr = Number(time.slice(0, 2));

  return (
    <div className="cc-home">
      <div className="cc-hero">
        <div>
          <p className="cc-hero-date">{longDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h2>Good {hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening"}, Raunaq</h2>
          <p className="cc-hero-sum">{summary}</p>
        </div>
        <Menu label="Customize home" trigger={<MoreHorizontal />} items={ALL_WIDGETS.map((w) => (
          { label: `${vis(w.id) ? "Hide" : "Show"} ${w.label}`, icon: vis(w.id) ? <EyeOff /> : <Eye />, onSelect: () => prefs.toggleWidget(w.id) }))} />
      </div>
      <div className="cc-home-grid">
        <div className="cc-home-ab">
          <div className="cc-home-col a">{col("a")}</div>
          <div className="cc-home-col b">{col("b")}</div>
        </div>
        <aside className="cc-home-col c">{col("c")}</aside>
      </div>
    </div>
  );
}

function AppsSection() {
  const { apps } = useAppRegistry();
  const prefs = usePrefs();
  const lastOpened = useApps((s) => s.lastOpened);
  const health = useHealth();
  const pinned = apps.filter((a) => prefs.favorites.includes(a.id));
  const list = pinned.length ? pinned : apps.filter((a) => lastOpened[a.id]).sort((a, b) => lastOpened[b.id].localeCompare(lastOpened[a.id])).slice(0, 6);
  return (
    <Section title={pinned.length ? "Pinned apps" : "Recent apps"} href="/apps" linkLabel="Library">
      {list.length === 0 ? <p className="cc-hs-empty">Star apps in the library to pin them here.</p> : (
        <div className="cc-tiles">{list.slice(0, 8).map((a) => (
          <Link key={a.id} href={appHref(a.id)} className="cc-tile" prefetch={false} title={a.name}>
            <AppIcon name={a.name} category={a.category} size={34} />
            <span>{a.name.replace(/\s*\(.*?\)/, "")}</span>
            {health.results[a.id]?.status && health.results[a.id]?.status !== "healthy" && <i className={`cc-health ${health.results[a.id]?.status}`} />}
          </Link>))}</div>
      )}
    </Section>
  );
}

/** AI daily briefing. Only runs on request, only with the data the user consented to in Studio AI, never with email. */
function Briefing() {
  const { today } = useNow();
  const consent = usePrefs((s) => s.aiConsent);
  const ctx = useAIContext();
  const [cfg, setCfg] = useState<{ configured: boolean; model?: string } | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const key = `cc-briefing-${today}`;
  useEffect(() => {
    fetch("/api/cc/ai").then((r) => (r.ok ? r.json() : { configured: false })).then(setCfg).catch(() => setCfg({ configured: false }));
    try { const v = sessionStorage.getItem(key); if (v) setOut(v); } catch { /* storage blocked */ }
  }, [key]);
  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/cc/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "briefing", context: ctx, consent: true }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error === "rate_limited" ? "Rate limit reached. Try again in a minute." : "The briefing request failed."); return; }
      setOut(j.text); try { sessionStorage.setItem(key, j.text); } catch { /* storage blocked */ }
    } finally { setBusy(false); }
  };
  const allowed = consent.tasks || consent.studio;
  return (
    <Section title="AI briefing" href="/studio-ai" linkLabel="Studio AI">
      {!cfg ? <Skeleton rows={2} /> : !cfg.configured ? <p className="cc-hs-empty">Gemini isn’t configured. Add <code className="cc-mono">GEMINI_API_KEY</code> to enable a daily briefing.</p>
        : !allowed ? <p className="cc-hs-empty">Choose what Gemini may read in <Link href="/studio-ai" className="cc-link-btn">Studio AI</Link> first.</p>
        : out ? <div className="cc-brief">{out.split("\n").filter(Boolean).slice(0, 8).map((l, i) => <p key={i}>{l.replace(/^[-*•]\s*/, "")}</p>)}<button className="cc-hs-link" onClick={run} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button></div>
        : <div className="cc-brief-cta"><p>Summarise today from {[consent.tasks && "tasks", consent.studio && "production and deliverables"].filter(Boolean).join(" and ")}.</p>
            <button className="cc-btn sm" onClick={run} disabled={busy}><Sparkles />{busy ? "Writing…" : "Generate briefing"}</button>{err && <p className="cc-err">{err}</p>}</div>}
    </Section>
  );
}
