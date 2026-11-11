"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useUI } from "./ui-store";
import { Tip } from "./ui";

/** Existing RM Studio modules (Deliverables, Projects, Scripts, Settings, Todos) run unchanged,
 *  same-origin, inside the Command Center shell. Their own sidebar is suppressed when framed
 *  (see AppShell), so the session, data stores and business logic are exactly the originals. */
export const STUDIO_MODULES: Record<string, string> = { deliverables: "Deliverables", projects: "Projects", scripts: "Scripts", settings: "Settings", todos: "Todos", calendar: "Studio calendar", dashboard: "Studio overview", admin: "Admin" };

export function StudioModule({ path }: { path: string[] }) {
  const target = "/" + path.map(encodeURIComponent).join("/");
  // Created after mount: a server-rendered iframe can finish loading before React attaches onLoad.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { setSrc(target + window.location.search); }, []);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const setHeaderExtra = useUI((s) => s.setHeaderExtra);
  const label = STUDIO_MODULES[path[0]] ?? path[0];

  useEffect(() => {
    setHeaderExtra(<><b className="cc-hx-name">{label}</b><span className="cc-spacer" /><Tip text="Reload"><button className="cc-iconbtn" aria-label="Reload module" onClick={() => { setLoaded(false); setNonce((n) => n + 1); }}><RefreshCw /></button></Tip></>);
    return () => setHeaderExtra(null);
  }, [label]);

  // Mirror in-module navigation into the shell URL so refresh/back keep the exact page.
  const onLoad = () => {
    setLoaded(true);
    try {
      const l = frame.current?.contentWindow?.location;
      if (!l || l.origin !== window.location.origin) return;
      const inner = l.pathname + l.search;
      if (inner.startsWith("/auth/")) return;
      const outer = "/studio" + inner;
      if (outer !== window.location.pathname + window.location.search) window.history.replaceState(null, "", outer);
    } catch { /* cross-origin after a redirect: leave the URL alone */ }
  };

  return (
    <div className="cc-frame studio">
      {!loaded && <div className="cc-frame-load" role="status"><div className="cc-frame-load-in"><b>Opening {label}</b><div className="cc-bar-ind"><i /></div></div></div>}
      {src && <iframe key={nonce} ref={frame} className="cc-iframe" title={label} src={src} onLoad={onLoad} />}
    </div>
  );
}
