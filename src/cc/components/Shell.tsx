"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu as MenuIcon, Moon, PanelLeft, Plus, RefreshCw, Search, Sun, Camera, CheckSquare, StickyNote, Lightbulb } from "lucide-react";
import { useApps, usePrefs, useShoots, useTasks } from "../store/stores";
import { useCloudSync, useSyncStatus } from "../store/sync";
import { bucketOf, diffDays } from "../lib/planner";
import { APPS_LINK, FOOTER, NAV, TITLES, type NavItem } from "./nav";
import { Menu, Tip, ToastHost } from "./ui";
import { useAppRegistry, useHealth, useNow } from "./data";
import { appHref } from "../apps/adapter";
import { AppIcon } from "./AppIcon";
import { useUI } from "./ui-store";
import { Palette } from "./Palette";
import { Capture } from "./Capture";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { today } = useNow();
  const prefs = usePrefs();
  const ui = useUI();
  const sync = useSyncStatus((s) => s.state);
  const tasks = useTasks((s) => s.tasks);
  const shoots = useShoots((s) => s.shoots);
  const ready = useRef(false);
  const { apps } = useAppRegistry();
  const health = useHealth((h) => h.results);
  const lastOpened = useApps((a) => a.lastOpened);

  useEffect(() => {
    void Promise.all([useTasks.persist.rehydrate(), useShoots.persist.rehydrate(), usePrefs.persist.rehydrate(), useApps.persist.rehydrate()]).then(() => { ready.current = true; });
  }, []);
  useCloudSync();
  // A Command Center page loaded inside a studio frame (old link to "/" or "/home") would nest a second
  // shell; hand the navigation to the top window instead. Same origin only.
  useEffect(() => {
    try { if (window.self !== window.top && window.top?.location.origin === window.location.origin) window.top.location.replace(window.location.href); } catch { /* cross-origin parent: ignore */ }
  }, []);
  useEffect(() => { ui.setDrawer(false); }, [pathname]);

  // keyboard: ⌘K palette, C capture, G+letter go-to
  useEffect(() => {
    let g = 0;
    const GO: Record<string, string> = { h: "/home", m: "/my-day", t: "/tasks", s: "/to-shoot", i: "/inbox", c: "/agenda", a: "/apps" };
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ui.setPalette(!useUI.getState().palette); return; }
      const el = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (Date.now() - g < 900 && GO[e.key]) { e.preventDefault(); g = 0; router.push(GO[e.key]); return; }
      if (e.key === "g") { g = Date.now(); return; }
      if (e.key === "c") { e.preventDefault(); ui.openCapture("task"); }
      if (e.key === "/") { e.preventDefault(); ui.setPalette(true); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [router]);

  const counts = useMemo(() => {
    let todayN = 0, overdue = 0;
    for (const t of tasks) { const b = bucketOf(t, today); if (b === "today") todayN++; if (b === "overdue") overdue++; }
    const sh = shoots.filter((s) => s.shootDate && s.shootDate >= today && diffDays(s.shootDate, today) <= 7 && !["Shot", "Published", "On Hold"].includes(s.status)).length;
    return { today: todayN, overdue, shoots: sh };
  }, [tasks, shoots, today]);

  const alerts = useMemo(() => {
    const a: { text: string; href: string }[] = [];
    const od = tasks.filter((t) => bucketOf(t, today) === "overdue");
    if (od.length) a.push({ text: `${od.length} overdue task${od.length > 1 ? "s" : ""}`, href: "/tasks" });
    for (const s of shoots) {
      if (s.shootDate && ["Ready to Shoot", "Scheduled", "Brief Needed", "Idea"].includes(s.status)) {
        const d = diffDays(s.shootDate, today);
        if (d >= 0 && d <= 2) a.push({ text: `Shoot ${d === 0 ? "today" : d === 1 ? "tomorrow" : "in 2 days"}: ${s.title}`, href: `/to-shoot?open=${s.id}` });
      }
      if (s.publishDeadline && s.status !== "Published" && diffDays(s.publishDeadline, today) <= 1) a.push({ text: `Publish deadline: ${s.title}`, href: `/to-shoot?open=${s.id}` });
    }
    if (sync === "error") a.push({ text: "Sync failing — changes are saved locally", href: "/integrations" });
    return a;
  }, [tasks, shoots, today, sync]);

  const pinned = useMemo(() => apps.filter((a) => prefs.favorites.includes(a.id)).slice(0, 6), [apps, prefs.favorites]);
  const recentApps = useMemo(() => apps.filter((a) => lastOpened[a.id] && !prefs.favorites.includes(a.id))
    .sort((a, b) => lastOpened[b.id].localeCompare(lastOpened[a.id])).slice(0, pinned.length ? 2 : 4), [apps, lastOpened, prefs.favorites, pinned.length]);
  const inWorkspace = pathname.startsWith("/workspace/");
  const inStudio = pathname.startsWith("/studio/");
  const hosted = inWorkspace || inStudio;
  const base = "/" + (pathname.split("/")[1] ?? "");
  const title = TITLES[base] ?? "Command Center";
  const dark = prefs.theme === "dark";
  const syncLabel = sync === "synced" ? "Synced to cloud" : sync === "local" ? "Saved on this device only" : sync === "error" ? "Sync error, saved locally" : "Syncing…";

  const navLink = (n: NavItem) => {
    const Icon = n.icon;
    const count = n.countKey ? counts[n.countKey] : 0;
    const current = base === n.href || (n.href.startsWith("/studio/") && pathname.startsWith(n.href)) ;
    const link = (
      <Link href={n.href} className="cc-link" aria-current={current ? "page" : undefined} prefetch={false}>
        <Icon /><span>{n.label}</span>
        {count > 0 && <em className={`cc-count ${n.countKey === "overdue" ? "hot" : ""}`}>{count}</em>}
      </Link>
    );
    return prefs.sidebarCollapsed ? <Tip key={n.href} text={n.label}>{link}</Tip> : <div key={n.href}>{link}</div>;
  };

  return (
    <div className="cc-root" data-theme={prefs.theme} data-collapsed={prefs.sidebarCollapsed} data-drawer={ui.drawer}>
      {ui.drawer && <div className="cc-drawer-scrim" onClick={() => ui.setDrawer(false)} />}
      <aside className="cc-sb" aria-label="Primary">
        <div className="cc-ws">
          <Menu label="Workspace menu" align="start" className="cc-ws-btn" trigger={<><span className="cc-mark">RM</span><span className="cc-ws-name">RM Studio</span><ChevronDown className="cc-ws-chev" /></>} items={[
            { label: session?.user?.email ?? "Signed in", icon: <span className={`cc-health ${sync === "synced" ? "healthy" : sync === "error" ? "offline" : sync === "local" ? "degraded" : ""}`} />, onSelect: () => router.push("/integrations") },
            { label: syncLabel, icon: <RefreshCw />, onSelect: () => router.push("/integrations") },
            { label: "", sep: true, onSelect: () => {} },
            { label: dark ? "Light theme" : "Dark theme", icon: dark ? <Sun /> : <Moon />, onSelect: () => prefs.set({ theme: dark ? "light" : "dark" }) },
            { label: prefs.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", icon: <PanelLeft />, onSelect: prefs.toggleSidebar },
            { label: "", sep: true, onSelect: () => {} },
            { label: "Sign out", icon: <LogOut />, onSelect: () => void signOut({ callbackUrl: "/auth/signin" }) },
          ]} />
        </div>
        <button className="cc-sb-search" onClick={() => ui.setPalette(true)} aria-label="Search and commands"><Search /><span>Search</span><kbd>⌘K</kbd></button>
        <nav className="cc-nav">
          {NAV.map((sec) => (
            <div key={sec.title || "core"} className="cc-navsec">
              {sec.title && <div className="cc-sec">{sec.title}</div>}
              {sec.items.map(navLink)}
            </div>
          ))}
          <div className="cc-navsec">
            <div className="cc-sec">Apps</div>
            {pinned.map((a) => <AppLink key={a.id} a={a} cur={pathname} h={health[a.id]?.status} />)}
            {recentApps.map((a) => <AppLink key={a.id} a={a} cur={pathname} h={health[a.id]?.status} />)}
            {navLink(APPS_LINK)}
          </div>
        </nav>
        <div className="cc-sb-foot">
          {FOOTER.map((n) => { const Icon = n.icon; return <Tip key={n.href} text={n.label}><Link href={n.href} className="cc-iconbtn" aria-label={n.label} aria-current={base === n.href ? "page" : undefined} prefetch={false}><Icon /></Link></Tip>; })}
          <span className="cc-spacer" />
          <Tip text={prefs.sidebarCollapsed ? "Expand" : "Collapse"}><button className="cc-iconbtn" onClick={prefs.toggleSidebar} aria-label="Toggle sidebar"><PanelLeft /></button></Tip>
        </div>
      </aside>

      <div className="cc-main">
        <header className="cc-hd">
          <button className="cc-iconbtn cc-mobile-only" onClick={() => ui.setDrawer(true)} aria-label="Open navigation"><MenuIcon /></button>
          <nav className="cc-crumb" aria-label="Breadcrumb">
            {inWorkspace ? <><Link href="/apps">Apps</Link><ChevronRight className="sep" /></> : inStudio ? <><span>Studio</span><ChevronRight className="sep" /></> : <h1>{title}</h1>}
          </nav>
          {hosted ? ui.headerExtra : <div className="cc-spacer" />}
          <button className="cc-iconbtn cc-mobile-only" onClick={() => ui.setPalette(true)} aria-label="Search"><Search /></button>
          <Menu label="Create" className="cc-btn sm ghost cc-new" trigger={<><Plus /><span>New</span></>} items={[
            { label: "Task", icon: <CheckSquare />, onSelect: () => ui.openCapture("task") },
            { label: "Shoot", icon: <Camera />, onSelect: () => ui.openCapture("shoot") },
            { label: "Idea", icon: <Lightbulb />, onSelect: () => ui.openCapture("idea") },
            { label: "Note", icon: <StickyNote />, onSelect: () => ui.openCapture("note") },
          ]} />
          <Menu label={`Notifications (${alerts.length})`} trigger={<><Bell />{alerts.length > 0 && <i className="cc-dot-badge" />}</>}
            items={alerts.length ? alerts.map((a) => ({ label: a.text, onSelect: () => router.push(a.href) })) : [{ label: "Nothing needs attention", onSelect: () => {} }]} />
        </header>
        <main className="cc-content" id="main" data-bleed={hosted || undefined}>{children}</main>
      </div>
      <button className="cc-fab" onClick={() => ui.openCapture("task")} aria-label="Quick capture"><Plus /></button>
      <Palette /><Capture /><ToastHost />
    </div>
  );
}

function AppLink({ a, cur, h }: { a: { id: string; name: string; category: string }; cur: string; h?: string }) {
  const href = appHref(a.id);
  return (
    <Link href={href} className="cc-link app" aria-current={cur === href ? "page" : undefined} prefetch={false} title={a.name}>
      <AppIcon name={a.name} category={a.category} size={18} /><span>{a.name}</span>
      {h && h !== "healthy" && h !== "unknown" ? <i className={`cc-health ${h}`} /> : null}
    </Link>
  );
}
