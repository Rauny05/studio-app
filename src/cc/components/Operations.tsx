"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { diffDays } from "../lib/planner";
import { Empty, Panel, Skeleton, fmtDay } from "./ui";
import { useDeliverables, useNow } from "./data";

export function Operations() {
  const { today } = useNow();
  const { rows, loading, error, reload } = useDeliverables();
  const d = useMemo(() => {
    const open = rows.filter((r) => r.overallStatus !== "done");
    return {
      awaitingPay: rows.filter((r) => r.overallStatus === "awaiting-payment"),
      inProgress: rows.filter((r) => r.overallStatus === "in-progress"),
      pending: rows.filter((r) => r.overallStatus === "pending"),
      goLive: open.filter((r) => r.goLiveDate && r.goLiveDate >= today && diffDays(r.goLiveDate, today) <= 14).sort((a, b) => a.goLiveDate!.localeCompare(b.goLiveDate!)),
      missedGoLive: open.filter((r) => r.goLiveDate && r.goLiveDate < today),
      noAdvance: open.filter((r) => !r.advance50),
    };
  }, [rows, today]);
  const List = ({ items, empty }: { items: typeof rows; empty: string }) => items.length === 0 ? <Empty title={empty} /> : <div className="cc-list">{items.slice(0, 12).map((r) => (
    <div key={r.id} className="cc-item"><span className="t">{r.brand} <span className="cc-faint">{r.pnNo}</span></span>
      <span className="cc-meta">{r.goLiveDate && <span>{fmtDay(r.goLiveDate, today)}</span>}<span className="cc-badge">{r.deliverables.filter((x) => x.status === "Completed").length}/{r.deliverables.length}</span>
        <span className={`cc-badge ${r.payment100 ? "ok" : r.advance50 ? "warn" : ""}`}>{r.payment100 ? "paid" : r.advance50 ? "50% received" : "no payment"}</span></span></div>))}</div>;
  return (
    <div className="cc-page">
      <div className="cc-pagehead"><h2>Operations</h2><span className="sub">Live from the deliverables sheet · read-only</span><div className="cc-spacer" />
        <button className="cc-btn" onClick={reload}><RefreshCw />Refresh</button><Link href="/deliverables" className="cc-btn primary">Open deliverables</Link></div>
      {error && <div className="cc-banner" role="alert"><div>Could not load deliverables ({error}).</div></div>}
      {loading && !rows.length ? <Skeleton rows={6} /> : <>
        <div className="cc-stats">
          <div className="cc-stat"><div className="n">{d.pending.length + d.inProgress.length}</div><div className="l">Active deliverables</div></div>
          <div className={`cc-stat ${d.awaitingPay.length ? "hot" : ""}`}><div className="n">{d.awaitingPay.length}</div><div className="l">Awaiting payment</div></div>
          <div className="cc-stat"><div className="n">{d.goLive.length}</div><div className="l">Go-live in 14 days</div></div>
          <div className={`cc-stat ${d.missedGoLive.length ? "hot" : ""}`}><div className="n">{d.missedGoLive.length}</div><div className="l">Go-live date passed</div></div>
          <div className="cc-stat"><div className="n">{d.noAdvance.length}</div><div className="l">No advance yet</div></div>
        </div>
        <div className="cc-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="cc-col"><Panel title="Awaiting payment" count={d.awaitingPay.length}><List items={d.awaitingPay} empty="No payments outstanding" /></Panel>
            <Panel title="Upcoming go-lives" count={d.goLive.length}><List items={d.goLive} empty="No go-lives in the next 14 days" /></Panel></div>
          <div className="cc-col"><Panel title="Go-live date passed, not done" count={d.missedGoLive.length}><List items={d.missedGoLive} empty="Nothing slipped" /></Panel>
            <Panel title="In progress" count={d.inProgress.length}><List items={d.inProgress} empty="Nothing in progress" /></Panel></div>
        </div>
        <p className="cc-faint" style={{ marginTop: 14 }}>The sheet stores payment <i>stages</i> (50% advance, 100%) and go-live dates, but no invoice amounts or payment due dates. So amounts, “overdue payments” and revenue charts are intentionally not shown — they would be invented. Add amount and due-date columns to the sheet to enable them. Go-live push reminders continue to run from the existing daily cron.</p>
      </>}
    </div>
  );
}
