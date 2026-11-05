"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, Star } from "lucide-react";
import { useApps, usePrefs, type AppRecord } from "../store/stores";
import { fuzzyScore } from "../lib/fuzzy";
import { appHref, resolveApp } from "../apps/adapter";
import { HealthDot, Modal, Skeleton, toast } from "./ui";
import { useAppRegistry, useHealth } from "./data";
import { AppIcon } from "./AppIcon";

export const CATEGORIES = ["Productivity", "Finance", "Operations", "Content and Media", "File Management", "Development", "Utilities", "Other"] as const;
const STATUS: Record<string, string> = { healthy: "Online", degraded: "Degraded", offline: "Offline", unknown: "Unknown", not_configured: "No URL" };
const MODE = { native: "Native", embedded: "Embedded", integrated: "Needs integration" } as const;

function ago(iso?: string) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

export function Apps() {
  const sp = useSearchParams();
  const router = useRouter();
  const view = sp.get("view") === "diagnostics" ? "diagnostics" : "apps";
  const { apps, all, loading } = useAppRegistry();
  const health = useHealth();
  const store = useApps();
  const prefs = usePrefs();
  const [q, setQ] = useState("");
  const [add, setAdd] = useState(false);
  const [local, setLocal] = useState(false);

  useEffect(() => { setLocal(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)); }, []);
  useEffect(() => { if (apps.length && !Object.keys(health.results).length) void health.check(apps); }, [apps.length]);

  const shown = useMemo(() => apps.filter((a) => !q || fuzzyScore(q, `${a.name} ${a.description} ${a.category}`) >= 0), [apps, q]);
  const pinned = shown.filter((a) => prefs.favorites.includes(a.id));
  const recent = shown.filter((a) => store.lastOpened[a.id] && !prefs.favorites.includes(a.id)).sort((a, b) => store.lastOpened[b.id].localeCompare(store.lastOpened[a.id])).slice(0, 4);
  const byCat = CATEGORIES.map((c) => [c, shown.filter((a) => (CATEGORIES.includes(a.category as never) ? a.category : "Other") === c)] as const).filter(([, l]) => l.length);

  const card = (a: AppRecord) => {
    const h = health.results[a.id]?.status;
    const fav = prefs.favorites.includes(a.id);
    return (
      <div key={a.id} className="cc-appcard">
        <Link href={appHref(a.id)} className="cc-appcard-link" prefetch={false} aria-label={`Open ${a.name}`} />
        <AppIcon name={a.name} category={a.category} size={38} />
        <div className="cc-appcard-tx"><b>{a.name}</b><p>{a.description}</p>
          <div className="cc-appcard-ft"><HealthDot s={h} /><span>{h ? STATUS[h] : "Checking"}</span>{store.lastOpened[a.id] && <span className="cc-faint">· {ago(store.lastOpened[a.id])}</span>}{a.localOnly && <span className="cc-faint">· this Mac</span>}</div>
        </div>
        <button className="cc-iconbtn cc-appcard-star" aria-label={fav ? `Unpin ${a.name}` : `Pin ${a.name}`} aria-pressed={fav} onClick={() => prefs.toggleFavorite(a.id)}><Star className={fav ? "on" : ""} /></button>
      </div>
    );
  };

  return (
    <div className="cc-view">
      <div className="cc-vbar">
        <div className="cc-vtabs" role="tablist">
          <button role="tab" className="cc-vtab" aria-selected={view === "apps"} onClick={() => router.replace("/apps")}>Applications</button>
          <button role="tab" className="cc-vtab" aria-selected={view === "diagnostics"} onClick={() => router.replace("/apps?view=diagnostics")}>Integration status</button>
        </div>
        <span className="cc-spacer" />
        <label className="cc-searchfield sm"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an app" aria-label="Find an app" /></label>
        {view === "diagnostics" && <button className="cc-btn sm" onClick={() => health.check(apps)} disabled={health.checking}><RefreshCw />{health.checking ? "Checking" : "Re-check"}</button>}
        <button className="cc-btn sm primary" onClick={() => setAdd(true)}><Plus /><span className="cc-hide-m">Add app</span></button>
      </div>
      <div className="cc-vbody"><div className="cc-vmain">
        {loading ? <Skeleton rows={6} /> : view === "apps" ? (
          <div className="cc-launch">
            {pinned.length > 0 && <section><h3>Pinned</h3><div className="cc-appgrid">{pinned.map(card)}</div></section>}
            {recent.length > 0 && <section><h3>Recently opened</h3><div className="cc-appgrid">{recent.map(card)}</div></section>}
            {byCat.map(([c, list]) => <section key={c}><h3>{c}<span>{list.length}</span></h3><div className="cc-appgrid">{list.map(card)}</div></section>)}
            {shown.length === 0 && <div className="cc-vempty"><b>No app matches “{q}”</b></div>}
          </div>
        ) : (
          <Diagnostics all={all} local={local} />
        )}
      </div></div>
      <AddApp open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

/** Admin view: how each app opens inside RM Studio, and every project that was deliberately left out. */
function Diagnostics({ all, local }: { all: AppRecord[]; local: boolean }) {
  const health = useHealth();
  const apps = all.filter((a) => (a.kind ?? "app") === "app");
  const excluded = all.filter((a) => a.kind === "excluded");
  return (
    <>
      <div className="cc-tbl">
        <div className="cc-row head"><span className="t">Application</span><span className="w120">Opens as</span><span className="w100">Health</span><span className="cc-hide-m t2">Detail</span></div>
        {apps.map((a) => {
          const h = health.results[a.id];
          const d = resolveApp(a, h, { originIsLocal: local });
          return (
            <div key={a.id} className="cc-row">
              <Link href={appHref(a.id)} className="cc-row-link" prefetch={false} aria-label={`Open ${a.name}`} />
              <span className="t"><AppIcon name={a.name} category={a.category} size={24} /><span className="nm"><b>{a.name}</b><small>{a.url ?? "No URL"}</small></span></span>
              <span className="w120"><span className={`cc-mode ${d.launchMode}`}>{MODE[d.launchMode]}</span></span>
              <span className="w100 st"><HealthDot s={h?.status} />{h ? STATUS[h.status] : "—"}</span>
              <span className="cc-hide-m t2 cc-faint">{d.launchMode === "integrated" ? d.reason : h?.embeddable === false ? "Blocks framing" : h?.httpStatus ? `HTTP ${h.httpStatus} · ${h.ms}ms` : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="cc-grp"><b>Not shown in RM Studio</b><span>{excluded.length}</span></div>
      <div className="cc-tbl">
        {excluded.map((a) => <div key={a.id} className="cc-row"><span className="t"><span className="nm"><b>{a.name}</b><small>{a.path ?? ""}</small></span></span><span className="t2 cc-faint">{a.excludeReason}</span></div>)}
      </div>
    </>
  );
}

function AddApp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useApps((s) => s.addApp);
  const [f, setF] = useState({ name: "", description: "", category: "Productivity", url: "", path: "", framework: "", integration: "embed" as AppRecord["integration"] });
  const ok = f.name.trim() && (!f.url || /^https?:\/\//.test(f.url));
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Add application">
      {(["name", "description", "url", "path", "framework"] as const).map((k) => (
        <div className="cc-field" key={k}><label className="cc-label">{k}</label><input className="cc-input" value={f[k]} placeholder={k === "url" ? "https://…" : ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
      ))}
      <div className="cc-field"><label className="cc-label">Category</label><select className="cc-select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="cc-field"><label className="cc-label">Integration</label><select className="cc-select" value={f.integration} onChange={(e) => setF({ ...f, integration: e.target.value as AppRecord["integration"] })}>
        <option value="embed">Embed in workspace (if the app allows framing)</option><option value="api">API integration</option></select></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="cc-btn ghost" onClick={onClose}>Cancel</button>
        <button className="cc-btn primary" disabled={!ok} onClick={() => {
          add({ id: `custom-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`, name: f.name.trim(), description: f.description, category: f.category || "Other", url: f.url || null, path: f.path || null,
            framework: f.framework || null, integration: f.integration, kind: "app", healthUrl: f.url || null, localOnly: /localhost|127\.0\.0\.1/.test(f.url) });
          toast("App added"); onClose();
        }}>Add</button>
      </div>
    </Modal>
  );
}
