"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { needsAttention } from "../lib/health";
import { HealthDot, Panel, Empty } from "./ui";
import { useAppRegistry, useHealth } from "./data";

export function HealthPage() {
  const { apps } = useAppRegistry();
  const h = useHealth();
  useEffect(() => { if (apps.length && !Object.keys(h.results).length) void h.check(apps); }, [apps.length]);
  const st = (id: string) => h.results[id]?.status;
  const sum = (s: string) => apps.filter((a) => st(a.id) === s).length;
  const bad = apps.filter((a) => needsAttention(st(a.id)));
  return (
    <div className="cc-page">
      <div className="cc-pagehead"><h2>App health</h2><span className="sub">Server-side probes, cached 60s</span><div className="cc-spacer" />
        <button className="cc-btn primary" onClick={() => h.check(apps)} disabled={h.checking}><RefreshCw />{h.checking ? "Checking…" : "Check all"}</button></div>
      <div className="cc-stats">
        {(["healthy", "degraded", "offline", "unknown", "not_configured"] as const).map((s) => <div className={`cc-stat ${s === "offline" && sum(s) ? "hot" : s === "healthy" ? "good" : ""}`} key={s}><div className="n">{sum(s)}</div><div className="l">{s.replace("_", " ")}</div></div>)}
      </div>
      {bad.length > 0 && <div className="cc-banner" role="alert"><div><b>Needs attention:</b> {bad.map((a) => a.name).join(", ")}</div></div>}
      <Panel title="All applications" count={apps.length}>
        {apps.length === 0 ? <Empty title="No applications" /> : (
          <div style={{ overflowX: "auto" }}><table className="cc-table"><thead><tr><th></th><th>App</th><th>Status</th><th>HTTP</th><th>Latency</th><th>Embeddable</th><th>Last check</th><th>Note</th></tr></thead>
            <tbody>{apps.map((a) => { const r = h.results[a.id]; return (
              <tr key={a.id}><td><HealthDot s={r?.status} /></td><td>{a.name}</td><td>{r?.status ?? "—"}</td><td>{r?.httpStatus ?? "—"}</td><td>{r?.ms ? `${r.ms}ms` : "—"}</td>
                <td>{r?.embeddable === undefined ? "—" : r.embeddable ? "yes" : "no"}</td><td className="cc-faint">{r?.checkedAt ? new Date(r.checkedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                <td className="cc-faint">{r?.reason ?? (a.localOnly ? "localhost app" : "")}</td></tr>); })}</tbody></table></div>
        )}
      </Panel>
      <p className="cc-faint" style={{ marginTop: 10 }}>A response of 2xx–4xx (including login redirects and 401/403) counts as reachable. 5xx/429 is degraded. A failed server-side request is offline. Localhost apps cannot be probed from a deployed server and show “unknown”.</p>
    </div>
  );
}
