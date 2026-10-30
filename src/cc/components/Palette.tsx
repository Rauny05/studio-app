"use client";

import { appHref } from "../apps/adapter";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, ArrowRight, Camera, CheckSquare, Clock, Mail, Moon, Plus, Search, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { fuzzyScore } from "../lib/fuzzy";
import { usePrefs, useShoots, useTasks } from "../store/stores";
import { ALL_NAV } from "./nav";
import { useAppRegistry } from "./data";
import { useUI } from "./ui-store";

interface Item { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void; alt?: () => void; keywords?: string }

export function Palette() {
  const { palette, setPalette, openCapture } = useUI();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const tasks = useTasks((s) => s.tasks);
  const shoots = useShoots((s) => s.shoots);
  const { apps } = useAppRegistry();
  const prefs = usePrefs();

  useEffect(() => { if (palette) { setQ(""); setSel(0); } }, [palette]);

  const go = (href: string, recent?: { kind: "app" | "task" | "shoot" | "route"; id: string; label: string }) => {
    if (recent) prefs.pushRecent({ ...recent, href });
    setPalette(false); router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const n of ALL_NAV) out.push({ id: `r:${n.href}`, group: "Go to", label: n.label, icon: <ArrowRight />, run: () => go(n.href, { kind: "route", id: n.href, label: n.label }), keywords: n.keywords });
    out.push(
      { id: "a:task", group: "Actions", label: "New task", hint: "C", icon: <Plus />, run: () => openCapture("task"), keywords: "create add todo" },
      { id: "a:shoot", group: "Actions", label: "New shoot", icon: <Camera />, run: () => openCapture("shoot"), keywords: "create add production" },
      { id: "a:note", group: "Actions", label: "New note", icon: <Plus />, run: () => openCapture("note") },
      { id: "a:idea", group: "Actions", label: "New content idea", icon: <Plus />, run: () => openCapture("idea") },
      { id: "a:plan", group: "Actions", label: "Plan my day", icon: <Clock />, run: () => go("/my-day?plan=1"), keywords: "reschedule review" },
      { id: "a:theme", group: "Actions", label: `Switch to ${prefs.theme === "dark" ? "light" : "dark"} theme`, icon: <Moon />, run: () => { prefs.set({ theme: prefs.theme === "dark" ? "light" : "dark" }); setPalette(false); } },
      { id: "a:ai", group: "Actions", label: "Ask Studio AI", icon: <Sparkles />, run: () => go("/studio-ai"), keywords: "gemini briefing" },
    );
    for (const a of apps) out.push({ id: `app:${a.id}`, group: "Applications", label: a.name, hint: "Open in workspace", icon: <AppWindow />, run: () => go(appHref(a.id), { kind: "app", id: a.id, label: a.name }), keywords: `${a.description} ${a.framework}` });
    for (const t of tasks.filter((t) => t.status !== "done" && t.status !== "dropped").slice(0, 300)) out.push({ id: `t:${t.id}`, group: "Tasks", label: t.title, hint: t.plannedDate ?? t.due, icon: <CheckSquare />, run: () => go(`/tasks?open=${t.id}`, { kind: "task", id: t.id, label: t.title }), keywords: t.tags.join(" ") });
    for (const s of shoots.slice(0, 300)) out.push({ id: `s:${s.id}`, group: "Production", label: s.title, hint: s.status, icon: <Camera />, run: () => go(`/to-shoot?open=${s.id}`, { kind: "shoot", id: s.id, label: s.title }), keywords: `${s.client ?? ""} ${s.brand ?? ""}` });
    return out;
  }, [tasks, shoots, apps, prefs.theme]);

  const results = useMemo<Item[]>(() => {
    const query = q.trim();
    if (!query) {
      const rec = prefs.recents.slice(0, 6).map((r): Item => ({ id: `rec:${r.kind}:${r.id}`, group: "Recent", label: r.label, hint: r.kind, icon: <Clock />, run: () => go(r.href) }));
      const searches = prefs.recentSearches.slice(0, 3).map((s): Item => ({ id: `rs:${s}`, group: "Recent searches", label: s, icon: <Search />, run: () => setQ(s) }));
      return [...rec, ...searches, ...items.filter((i) => i.group === "Actions").slice(0, 5)];
    }
    const scored = items.map((i) => ({ i, s: Math.max(fuzzyScore(query, i.label), fuzzyScore(query, i.keywords ?? "") - 200) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 24).map((x) => x.i);
    const extra: Item[] = [
      { id: "mk:task", group: "Create", label: `Create task: ${query}`, icon: <Plus />, run: () => openCapture("task", query) },
      { id: "mk:shoot", group: "Create", label: `Create shoot: ${query}`, icon: <Camera />, run: () => openCapture("shoot", query) },
      { id: "mk:mail", group: "Search", label: `Search Gmail for “${query}”`, icon: <Mail />, run: () => { prefs.pushSearch(query); go(`/inbox?q=${encodeURIComponent(query)}`); } },
    ];
    return [...scored, ...extra];
  }, [q, items, prefs.recents, prefs.recentSearches]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = results[sel]; if (!it) return; if ((e.metaKey || e.ctrlKey) && it.alt) it.alt(); else it.run(); }
  };

  let lastGroup = "";
  return (
    <Dialog.Root open={palette} onOpenChange={setPalette}>
      <Dialog.Portal>
        <Dialog.Overlay className="cc-overlay" />
        <Dialog.Content className="cc-dialog cc-pal" aria-describedby={undefined} onKeyDown={onKey}>
          <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>Command palette</Dialog.Title>
          <div className="cc-pal-in">
            <Search size={16} style={{ color: "var(--tx3)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps, tasks, shoots — or type to create…" aria-label="Search" role="combobox" aria-expanded aria-controls="cc-pal-list" />
            <kbd>esc</kbd>
          </div>
          <div className="cc-pal-list" id="cc-pal-list" role="listbox" ref={listRef}>
            {results.length === 0 && <div className="cc-empty">Nothing found</div>}
            {results.map((it, i) => {
              const head = it.group !== lastGroup ? ((lastGroup = it.group), <div className="cc-pal-g" key={`g${it.group}${i}`}>{it.group}</div>) : null;
              return (
                <div key={it.id}>
                  {head}
                  <button role="option" aria-selected={i === sel} className="cc-pal-i" data-on={i === sel} onMouseMove={() => setSel(i)} onClick={() => it.run()}>
                    {it.icon}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>{it.hint && <small>{it.hint}</small>}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="cc-pal-ft"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⌘</kbd><kbd>↵</kbd> launch app</span></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
