"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Copy, Expand, RefreshCw, ShieldCheck } from "lucide-react";
import { useApps, usePrefs } from "../store/stores";
import { appHref, resolveApp, resolveSlug, type ApplicationDefinition } from "../apps/adapter";
import { HealthDot, Menu, Skeleton, Tip, toast } from "./ui";
import { useAppRegistry, useHealth } from "./data";
import { useUI } from "./ui-store";
import { AppIcon } from "./AppIcon";

const MODE_LABEL = { native: "Native", embedded: "Embedded", integrated: "Integration needed" } as const;
const AUTH_LABEL = { "rm-session": "RM Studio session", "own-login": "Own sign-in (inside the frame)", none: "No sign-in", unknown: "Not verified" } as const;

/** Keeps a crash in the host UI from taking down the shell; the sidebar and header stay usable. */
class ApplicationErrorBoundary extends Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : "Unknown error" }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="cc-page narrow"><div className="cc-callout warn"><AlertTriangle /><div><b>This workspace failed to load</b><p>{this.state.err}</p><button className="cc-btn sm" onClick={() => this.setState({ err: null })}>Try again</button></div></div></div>;
  }
}

export function AppWorkspace({ slug }: { slug: string }) {
  return <ApplicationErrorBoundary><ApplicationHost slug={slug} /></ApplicationErrorBoundary>;
}

function ApplicationHost({ slug }: { slug: string }) {
  const { apps, all, loading } = useAppRegistry();
  const health = useHealth();
  const markOpened = useApps((s) => s.markOpened);
  const prefs = usePrefs();
  const setHeaderExtra = useUI((s) => s.setHeaderExtra);
  const [local, setLocal] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const frameBox = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const id = useMemo(() => resolveSlug(slug, all.map((a) => a.id)), [slug, all]);
  const app = all.find((a) => a.id === id);
  const probe = id ? health.results[id] : undefined;
  const def = useMemo<ApplicationDefinition | null>(() => (app ? resolveApp(app, probe, { originIsLocal: local }) : null), [app, probe, local]);

  useEffect(() => { setLocal(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)); }, []);
  useEffect(() => {
    if (!app) return;
    if (app.kind === "host") { router.replace("/home"); return; }
    if (app.kind === "excluded") return;
    markOpened(app.id); void health.check([app]);
  }, [app?.id]);
  useEffect(() => { setLoaded(false); setSlow(false); }, [def?.launchMode, def?.deploymentUrl, nonce]);
  useEffect(() => {
    if (def?.launchMode !== "embedded" || loaded) return;
    const t = setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, [def?.launchMode, loaded, nonce, def?.deploymentUrl]);

  const reload = useCallback(() => { setNonce((n) => n + 1); if (app) void health.check([app]); }, [app]);
  const fullscreen = useCallback(() => { void frameBox.current?.requestFullscreen?.().catch(() => toast("Fullscreen was blocked by the browser", { tone: "err" })); }, []);

  const switchList = useMemo(() => {
    const rank = (a: { id: string }) => (prefs.favorites.includes(a.id) ? 0 : 1);
    return apps.filter((a) => a.id !== id && a.url).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 14);
  }, [apps, id, prefs.favorites]);

  // Application name, status and controls live in the persistent RM Studio header.
  useEffect(() => {
    if (!def) { setHeaderExtra(null); return; }
    setHeaderExtra(
      <>
        <span className="cc-hx-sep" />
        <AppIcon name={def.name} category={def.category} size={20} />
        <b className="cc-hx-name">{def.name}</b>
        <span className={`cc-mode ${def.launchMode}`}>{MODE_LABEL[def.launchMode]}</span>
        <HealthDot s={def.status} />
        <span className="cc-spacer" />
        {def.launchMode === "embedded" && <>
          <Tip text="Reload app"><button className="cc-iconbtn" onClick={reload} aria-label="Reload app"><RefreshCw /></button></Tip>
          <Tip text="Fullscreen"><button className="cc-iconbtn" onClick={fullscreen} aria-label="Fullscreen"><Expand /></button></Tip>
        </>}
        <Menu label={`Switch from ${def.name}`} trigger={<ArrowLeftRight />} items={switchList.map((a) => ({ label: a.name, onSelect: () => router.push(appHref(a.id)) }))} />
        {def.launchMode === "embedded" && <Menu label="App options" trigger={<span aria-hidden>⋯</span>} items={[
          { label: "Copy workspace link", icon: <Copy />, onSelect: () => { void navigator.clipboard.writeText(location.origin + appHref(def.id)); toast("Link copied"); } },
          { label: "Re-check embed headers", icon: <ShieldCheck />, onSelect: () => app && void health.check([app]) },
        ]} />}
      </>,
    );
    return () => setHeaderExtra(null);
  }, [def, switchList, reload, fullscreen, router]);

  if (loading && !app) return <div className="cc-page"><Skeleton rows={4} /></div>;
  if (!app || !def) return (
    <div className="cc-page"><div className="cc-callout"><AlertTriangle /><div><b>No application “{slug}”</b><p>It is not in the registry. Browse the library to find it or add it.</p><Link className="cc-btn sm" href="/apps">Application library</Link></div></div></div>
  );

  if (app.kind === "excluded") return (
    <div className="cc-page narrow"><Header def={def} sub={app.path ?? ""} />
      <div className="cc-callout"><AlertTriangle /><div><b>Not an application in RM Studio</b><p>{app.excludeReason}</p><Link className="cc-btn sm" href="/apps">Application library</Link></div></div></div>
  );
  if (def.launchMode === "native") return <NativeHub def={def} />;
  if (def.launchMode === "integrated") return <IntegrationStatus def={def} onRecheck={reload} checking={health.checking} />;

  return (
    <div className="cc-frame" ref={frameBox}>
      {!loaded && (
        <div className="cc-frame-load" role="status">
          <div className="cc-frame-load-in">
            <AppIcon name={def.name} category={def.category} size={36} />
            <b>Opening {def.name}</b>
            <div className="cc-bar-ind"><i /></div>
            {slow && <p>Still waiting. If this app asks you to sign in and the page stays blank, your browser may block third-party cookies for embedded apps. <button className="cc-link-btn" onClick={reload}>Reload</button></p>}
          </div>
        </div>
      )}
      <iframe
        key={`${def.id}-${nonce}`}
        className="cc-iframe"
        title={def.name}
        src={def.deploymentUrl ?? undefined}
        onLoad={() => setLoaded(true)}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-read; clipboard-write; camera; microphone; fullscreen; geolocation"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation"
      />
    </div>
  );
}

function NativeHub({ def }: { def: ApplicationDefinition }) {
  return (
    <div className="cc-page narrow">
      <Header def={def} sub="Runs inside Command Center — no frame, no second login." />
      <div className="cc-tbl">
        {def.nativeRoutes?.map((r) => <Link key={r.href} href={r.href} className="cc-row"><span className="t">{r.label}</span><span className="cc-faint">{r.href}</span></Link>)}
      </div>
    </div>
  );
}

function Header({ def, sub }: { def: ApplicationDefinition; sub: string }) {
  return (
    <div className="cc-ph">
      <AppIcon name={def.name} category={def.category} size={36} />
      <div><h2>{def.name}</h2><p>{sub}</p></div>
    </div>
  );
}

function IntegrationStatus({ def, onRecheck, checking }: { def: ApplicationDefinition; onRecheck: () => void; checking: boolean }) {
  const facts: [string, string][] = [
    ["Launch mode", MODE_LABEL[def.launchMode]],
    ["Embedding", def.embeddingAllowed === null ? "Unknown" : def.embeddingAllowed ? "Allowed" : "Blocked by the app"],
    ["Sign-in", AUTH_LABEL[def.authenticationMode]],
    ["Health", def.status.replace("_", " ")],
    ["Deployment", def.deploymentUrl ?? "None registered"],
  ];
  return (
    <div className="cc-page narrow">
      <Header def={def} sub={def.description} />
      <div className="cc-callout warn"><AlertTriangle /><div><b>Can’t render inside RM Studio yet</b><p>{def.reason}</p></div></div>
      {def.requirements.length > 0 && (<section className="cc-sect"><h3>To get it working</h3><ol className="cc-steps">{def.requirements.map((r) => <li key={r}>{r.split("`").map((part, i) => (i % 2 ? <code key={i} className="cc-mono">{part}</code> : part))}</li>)}</ol></section>)}
      <section className="cc-sect"><h3>Details</h3>
        <dl className="cc-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>
      <div className="cc-actions"><button className="cc-btn" onClick={onRecheck} disabled={checking}><RefreshCw /> {checking ? "Checking…" : "Re-check"}</button><Link className="cc-btn ghost" href="/apps">Back to library</Link></div>
    </div>
  );
}
