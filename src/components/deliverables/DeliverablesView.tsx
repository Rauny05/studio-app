"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { DeliverableRow, DeliverableItem, ActivityEntry } from "@/app/api/deliverables/route";
import { usePermission } from "@/hooks/use-permission";

// ── Deliverable-type helpers ──────────────────────────────────────────────────

function inferType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("reel"))                                      return "reel";
  if (l.includes("stor"))                                      return "story";
  if (l.includes("youtube") || (l.includes("video") && !l.includes("stor"))) return "youtube";
  if (l.includes("podcast") || l.includes("episode"))         return "podcast";
  if (l.includes("post") || l.includes("ig ") || l.includes("instagram")) return "post";
  return "general";
}

const TYPE_META: Record<string, { subject: string; linkLabel: string }> = {
  reel:    { subject: "Reel posted",        linkLabel: "Reel link"    },
  story:   { subject: "Story uploaded",     linkLabel: "Story link"   },
  youtube: { subject: "Video published",    linkLabel: "Video link"   },
  post:    { subject: "Post live",          linkLabel: "Post link"    },
  podcast: { subject: "Episode released",   linkLabel: "Episode link" },
  general: { subject: "Deliverable posted", linkLabel: "Link"         },
};

function generateEmailText({
  pocName, deliverableName, deliverableType, currentDate,
  liveUrl, creatorName, agencyName, allDeliverables,
}: {
  pocName: string; deliverableName: string; deliverableType: string;
  currentDate: string; liveUrl: string; creatorName: string;
  agencyName: string; allDeliverables: Array<{ label: string; status: string }>;
}): string {
  const meta  = TYPE_META[deliverableType] ?? TYPE_META.general;
  const byline = [creatorName, agencyName].filter(Boolean).join(" - ");
  const list   = allDeliverables
    .map((d) => `${d.label} - ${d.status === "Completed" ? "Completed" : "Pending"}`)
    .join("\n");
  return `Hi Salil,

${deliverableName} posted (${currentDate})

${meta.linkLabel}:
${liveUrl || "—"}

List of all deliverables${byline ? ` from ${byline}` : ""}

${list}

Thanks`.trim();
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

function stableId(rowId: string, idx: number): string {
  return `${rowId}-del-${idx}`;
}

const POLL_INTERVAL = 30_000;

const STATUS_CONFIG = {
  pending:           { label: "Pending",          stripeColor: "#737373" },
  "in-progress":     { label: "In Progress",      stripeColor: "#f59e0b" },
  "awaiting-payment":{ label: "Awaiting Payment", stripeColor: "#3b82f6" },
  done:              { label: "Done",             stripeColor: "#22c55e" },
};

const PAYMENT_STEPS = ["Email", "50%", "Paid"];

// Hardcoded agency chips — order is display order
const AGENCY_CHIPS = ["LWT", "Momentum", "Jonathan/Pianosa", "Sociowash", "Socialcurrent"];

// Match a row against an agency chip label — checks pocName AND pocCompany,
// splits "Jonathan/Pianosa" into ["jonathan","pianosa"] and tests each part
function matchesAgency(row: DeliverableRow, agency: string): boolean {
  const parts = agency.toLowerCase().split("/").map((p) => p.trim());
  const n = row.pocName.toLowerCase();
  const c = row.pocCompany.toLowerCase();
  return parts.some((p) => n.includes(p) || c.includes(p));
}

function computeStatus(
  deliverables: DeliverableItem[],
  payment100: boolean
): DeliverableRow["overallStatus"] {
  if (!deliverables.length) return "pending";
  const allDone = deliverables.every((d) => d.status === "Completed");
  if (allDone && payment100) return "done";
  if (allDone) return "awaiting-payment";
  if (deliverables.some((d) => d.status === "Completed")) return "in-progress";
  return "pending";
}

// ── Highlight ─────────────────────────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="dl-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePnNo(existingRows: DeliverableRow[]): string {
  const now = new Date();
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = months[now.getMonth()];
  const yr  = String(now.getFullYear()).slice(-2);
  const prefix = `${mon}${yr}-`;
  const taken = new Set(
    existingRows
      .filter((r) => r.pnNo.toUpperCase().startsWith(prefix))
      .map((r) => parseInt(r.pnNo.split("-")[1] ?? "0", 10))
      .filter((n) => !isNaN(n))
  );
  let n = 1;
  while (taken.has(n)) n++;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

// ── Create Deliverable Modal ──────────────────────────────────────────────────

function CreateDeliverableModal({
  allRows,
  onClose,
  onCreate,
}: {
  allRows: DeliverableRow[];
  onClose: () => void;
  onCreate: (row: DeliverableRow) => Promise<void>;
}) {
  const suggestedPn = useMemo(() => generatePnNo(allRows), [allRows]);
  const [pnNo,       setPnNo]       = useState(suggestedPn);
  const [brand,      setBrand]      = useState("");
  const [pocName,    setPocName]    = useState("");
  const [pocCompany, setPocCompany] = useState("");
  const [note,       setNote]       = useState("");
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [paymentStep,  setPaymentStep]  = useState<DeliverableRow["paymentStep"]>(0);
  const [newDel, setNewDel] = useState("");
  const [saving, setSaving] = useState(false);
  const newDelRef = useRef<HTMLInputElement>(null);
  const brandRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    brandRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addDeliverable() {
    const label = newDel.trim();
    if (!label) return;
    setDeliverables((prev) => [...prev, { label, status: "Pending" }]);
    setNewDel("");
    newDelRef.current?.focus();
  }

  function toggleDel(i: number) {
    setDeliverables((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, status: d.status === "Completed" ? "Pending" : "Completed" } : d
      )
    );
  }

  function removeDel(i: number) {
    setDeliverables((prev) => prev.filter((_, idx) => idx !== i));
  }

  function togglePaymentStep(step: number) {
    setPaymentStep((prev) => (prev === step + 1 ? step : step + 1) as DeliverableRow["paymentStep"]);
  }

  const overallStatus = computeStatus(deliverables, paymentStep >= 3);

  async function handleCreate() {
    if (!brand.trim()) { brandRef.current?.focus(); return; }
    setSaving(true);
    const row: DeliverableRow = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      pnNo: pnNo.trim() || suggestedPn,
      brand: brand.trim(),
      deliverables,
      poc: pocName.trim(),
      pocName: pocName.trim(),
      pocCompany: pocCompany.trim(),
      emailSent:  paymentStep >= 1,
      advance50:  paymentStep >= 2,
      payment100: paymentStep >= 3,
      invoiceNumber: "",
      note: note.trim(),
      paymentStep,
      overallStatus,
      month: (() => {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const d = new Date();
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
      })(),
    };
    try {
      await onCreate(row);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  const canSave = brand.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-modal-panel dl-create-panel">

        {/* Header */}
        <div className="dl-modal-header">
          <div className="dl-modal-header-left" style={{ gap: 8 }}>
            {/* Editable PN badge */}
            <span className="dl-pn-badge" style={{ cursor: "text" }}>
              <span className="dl-pn-dot" data-status={overallStatus} />
              <input
                className="dl-create-pn-input"
                value={pnNo}
                onChange={(e) => setPnNo(e.target.value.toUpperCase())}
                placeholder={suggestedPn}
                title="Edit project number"
              />
            </span>
            <span className="dl-status-pill" data-status={overallStatus}>
              {STATUS_CONFIG[overallStatus].label}
            </span>
            <span className="dl-create-new-badge">New card</span>
          </div>
          <button className="kanban-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="dl-modal-body">

          {/* Brand name — most important field */}
          <input
            ref={brandRef}
            className="dl-create-brand-input"
            placeholder="Brand / client name…"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") newDelRef.current?.focus(); }}
          />

          {/* POC row */}
          <div className="dl-create-poc-row">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input
              className="dl-create-poc-input"
              placeholder="POC name…"
              value={pocName}
              onChange={(e) => setPocName(e.target.value)}
            />
            <span className="dl-create-poc-sep">·</span>
            <input
              className="dl-create-poc-input"
              placeholder="Company / agency…"
              value={pocCompany}
              onChange={(e) => setPocCompany(e.target.value)}
            />
          </div>

          {/* Deliverables */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">
              Deliverables
              <span className="dl-modal-section-hint">
                {deliverables.length === 0 ? "Tap chip to mark done" : deliverables.every((d) => d.status === "Completed") ? "✓ All done" : "Tap to mark done"}
              </span>
            </div>
            <div className="dl-modal-chips">
              {deliverables.map((item, i) => {
                const done = item.status === "Completed";
                return (
                  <button
                    key={i}
                    className={`dl-modal-chip ${done ? "done" : "pending"}`}
                    onClick={() => toggleDel(i)}
                    title={done ? "Mark as pending" : "Mark as done"}
                  >
                    <span className="dl-chip-dot" data-done={done} />
                    {item.label}
                    {done ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity={0.5}>
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    )}
                    <span
                      className="dl-chip-remove"
                      role="button"
                      aria-label="Remove"
                      onClick={(e) => { e.stopPropagation(); removeDel(i); }}
                    >×</span>
                  </button>
                );
              })}

              {/* Ghost chip input */}
              <div className="dl-chip-ghost-wrap">
                <input
                  ref={newDelRef}
                  className="dl-chip-ghost-input"
                  placeholder="+ Add deliverable…"
                  value={newDel}
                  onChange={(e) => setNewDel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addDeliverable();
                    if (e.key === "Escape") setNewDel("");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">
              Payment
              <span className="dl-modal-section-hint">Tap to advance</span>
            </div>
            <div className="dl-payment" style={{ gap: 4 }}>
              {PAYMENT_STEPS.map((step, i) => (
                <div key={step} className="dl-payment-step">
                  <button
                    className="dl-modal-payment-btn"
                    style={i < paymentStep ? { background: "#22c55e", borderColor: "#22c55e" } : {}}
                    onClick={() => togglePaymentStep(i)}
                    title={`Toggle: ${step}`}
                  >
                    {i < paymentStep && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span className="dl-payment-label" data-active={i < paymentStep}>{step}</span>
                  {i < PAYMENT_STEPS.length - 1 && (
                    <div className="dl-payment-line" data-active={i + 1 <= paymentStep} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">Notes</div>
            <textarea
              className="dl-modal-notes-input"
              placeholder="Add notes, deliverable specs, shoot details…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="dl-modal-footer">
          <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="kanban-btn-primary"
            disabled={!canSave || saving}
            onClick={handleCreate}
            style={{ minWidth: 120 }}
          >
            {saving ? "Saving…" : "Save card"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deliverable Modal ─────────────────────────────────────────────────────────
function DeliverableModal({
  row,
  onClose,
  onSave,
  onDelete,
  readOnly = false,
}: {
  row: DeliverableRow;
  onClose: () => void;
  onSave: (updated: DeliverableRow) => Promise<void>;
  onDelete?: () => Promise<void>;
  readOnly?: boolean;
}) {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? session?.user?.name ?? "unknown";

  const [local, setLocal] = useState<DeliverableRow>({
    ...row,
    deliverables: row.deliverables.map((d, i) => ({ ...d, id: d.id ?? stableId(row.id, i) })),
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [sheetState, setSheetState] = useState<"idle" | "syncing" | "ok" | "error" | "setup">("idle");
  const [newDel, setNewDel] = useState("");
  const newDelRef = useRef<HTMLInputElement>(null);
  const [pnCopied, setPnCopied] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<{ item: DeliverableItem; index: number } | null>(null);

  function copyPn() {
    navigator.clipboard.writeText(local.pnNo.toUpperCase()).then(() => {
      setPnCopied(true);
      setTimeout(() => setPnCopied(false), 1800);
    });
  }

  const status = STATUS_CONFIG[local.overallStatus];

  function toggleChip(i: number) {
    setLocal((prev) => {
      const deliverables = prev.deliverables.map((d, idx) =>
        idx === i ? { ...d, status: (d.status === "Completed" ? "Pending" : "Completed") as DeliverableItem["status"] } : d
      );
      const overallStatus = computeStatus(deliverables, prev.payment100);
      return { ...prev, deliverables, overallStatus };
    });
  }

  function removeChip(i: number) {
    setLocal((prev) => {
      const deliverables = prev.deliverables.filter((_, idx) => idx !== i);
      return { ...prev, deliverables, overallStatus: computeStatus(deliverables, prev.payment100) };
    });
  }

  function addDeliverable() {
    const label = newDel.trim();
    if (!label) return;
    setLocal((prev) => {
      const deliverables = [...prev.deliverables, { label, status: "Pending" as DeliverableItem["status"] }];
      return { ...prev, deliverables, overallStatus: computeStatus(deliverables, prev.payment100) };
    });
    setNewDel("");
    newDelRef.current?.focus();
  }

  function togglePaymentStep(step: number) {
    setLocal((prev) => {
      const newStep = (prev.paymentStep === step + 1 ? step : step + 1) as DeliverableRow["paymentStep"];
      const emailSent = newStep >= 1;
      const advance50 = newStep >= 2;
      const payment100 = newStep >= 3;
      return { ...prev, paymentStep: newStep, emailSent, advance50, payment100, overallStatus: computeStatus(prev.deliverables, payment100) };
    });
  }

  async function handleSaveLocal() {
    setSaveState("saving");
    try {
      await onSave(local);
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  function handleSyncToSheet() {
    setSheetState("syncing");
    fetch("/api/deliverables/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.setup) { setSheetState("setup"); return; }
        setSheetState("ok");
        setTimeout(() => setSheetState("idle"), 2000);
      })
      .catch(() => {
        setSheetState("error");
        setTimeout(() => setSheetState("idle"), 2000);
      });
  }

  async function handleCompletionConfirm(url: string) {
    if (!completionTarget) return;
    const { item, index } = completionTarget;
    const now = new Date().toISOString();
    const updatedDeliverables = local.deliverables.map((d, idx) =>
      idx === index
        ? { ...d, status: "Completed" as const, completedAt: now, completedBy: userEmail, publishedUrl: url || d.publishedUrl, emailDrafted: true }
        : d
    );
    const newEntries: ActivityEntry[] = [
      { type: "deliverable_completed", message: `${item.label} marked complete`, deliverableId: item.id, deliverableLabel: item.label, createdAt: now },
      ...(url ? [{ type: "url_added" as const, message: `Live URL added for ${item.label}`, deliverableId: item.id, deliverableLabel: item.label, createdAt: now }] : []),
      { type: "email_generated", message: `Completion email generated for ${item.label}`, deliverableId: item.id, deliverableLabel: item.label, createdAt: now },
    ];
    const updatedRow: DeliverableRow = {
      ...local,
      deliverables: updatedDeliverables,
      activityLog: [...(local.activityLog ?? []), ...newEntries],
      overallStatus: computeStatus(updatedDeliverables, local.payment100),
    };
    setLocal(updatedRow);
    setCompletionTarget(null);
    // Auto-save to Redis
    setSaveState("saving");
    try { await onSave(updatedRow); setSaveState("ok"); setTimeout(() => setSaveState("idle"), 1800); }
    catch { setSaveState("error"); setTimeout(() => setSaveState("idle"), 2000); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !completionTarget) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, completionTarget]);

  const hasChanges = JSON.stringify(local) !== JSON.stringify(row);
  const allDone = local.deliverables.length > 0 && local.deliverables.every((d) => d.status === "Completed");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-modal-panel">

        {/* Header */}
        <div className="dl-modal-header">
          <div className="dl-modal-header-left">
            <span className="dl-pn-badge">
              <span className="dl-pn-dot" data-status={local.overallStatus} />
              {local.pnNo.toUpperCase()}
              <button
                className="dl-pn-copy-btn"
                onClick={copyPn}
                title="Copy PN"
                aria-label="Copy PN number"
              >
                {pnCopied ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </span>
            <span className="dl-status-pill" data-status={local.overallStatus}>
              {status.label}
            </span>
            {readOnly && (
              <span className="dl-readonly-pill">View only</span>
            )}
            {!readOnly && hasChanges && (
              <span className="dl-modal-unsaved">● unsaved</span>
            )}
          </div>
          <button className="kanban-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="dl-modal-body">
          <h2 className="dl-modal-brand">{local.brand}</h2>

          {/* POC */}
          {local.pocName && (
            <div className="dl-poc" style={{ marginBottom: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span className="dl-poc-name">{local.pocName}</span>
              {local.pocCompany && <span className="dl-poc-company">{local.pocCompany}</span>}
            </div>
          )}

          {/* Deliverables — per-item rows with completion flow */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">
              Deliverables
              <span className="dl-modal-section-hint">
                {allDone ? "✓ All done" : `${local.deliverables.filter(d => d.status === "Completed").length}/${local.deliverables.length} done`}
              </span>
            </div>

            {/* All-done banner */}
            {allDone && !local.payment100 && !readOnly && (
              <div className="dl-all-done-banner">
                <span>🎉 All deliverables completed!</span>
                <button
                  className="dl-all-done-cta"
                  onClick={() => setLocal((prev) => ({ ...prev, paymentStep: 1 as 0|1|2|3, emailSent: true, overallStatus: "awaiting-payment" }))}
                >
                  → Mark Awaiting Payment
                </button>
              </div>
            )}

            <div className="dl-item-list">
              {local.deliverables.map((item, i) => {
                const done = item.status === "Completed";
                const itemType = item.type ?? inferType(item.label);
                return (
                  <div key={i} className={`dl-item-row${done ? " done" : ""}`}>
                    <div className="dl-item-row-left">
                      <span className="dl-chip-dot" data-done={done} />
                      <span className="dl-item-label">{item.label}</span>
                      <span className="dl-item-type-tag">{itemType}</span>
                    </div>
                    <div className="dl-item-row-right">
                      {done ? (
                        <>
                          <span className="dl-item-status-badge done">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Completed
                          </span>
                          {item.completedAt && (
                            <span className="dl-item-ts">{fmtDate(item.completedAt)}</span>
                          )}
                          {item.publishedUrl && (
                            <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="dl-item-url-btn" onClick={(e) => e.stopPropagation()}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              View
                            </a>
                          )}
                          {!readOnly && (
                            <button className="dl-item-undo-btn" onClick={(e) => { e.stopPropagation(); toggleChip(i); }}>Undo</button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="dl-item-status-badge pending">Pending</span>
                          {!readOnly && (
                            <button
                              className="dl-mark-complete-btn"
                              onClick={(e) => { e.stopPropagation(); setCompletionTarget({ item, index: i }); }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Mark Complete
                            </button>
                          )}
                        </>
                      )}
                      {!readOnly && (
                        <button
                          className="dl-item-remove-btn"
                          onClick={(e) => { e.stopPropagation(); removeChip(i); }}
                          aria-label="Remove deliverable"
                        >×</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Ghost add input */}
              {!readOnly && (
                <div className="dl-chip-ghost-wrap" style={{ marginTop: 6 }}>
                  <input
                    ref={newDelRef}
                    className="dl-chip-ghost-input"
                    placeholder="+ Add deliverable…"
                    value={newDel}
                    onChange={(e) => setNewDel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addDeliverable();
                      if (e.key === "Escape") setNewDel("");
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Payment pipeline */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">
              Payment
              <span className="dl-modal-section-hint">Tap to advance</span>
            </div>
            <div className="dl-payment" style={{ gap: 4 }}>
              {PAYMENT_STEPS.map((step, i) => (
                <div key={step} className="dl-payment-step">
                  <button
                    className="dl-modal-payment-btn"
                    style={i < local.paymentStep ? { background: "#22c55e", borderColor: "#22c55e" } : {}}
                    onClick={() => togglePaymentStep(i)}
                    title={`Toggle: ${step}`}
                  >
                    {i < local.paymentStep && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span className="dl-payment-label" data-active={i < local.paymentStep}>{step}</span>
                  {i < PAYMENT_STEPS.length - 1 && (
                    <div className="dl-payment-line" data-active={i + 1 <= local.paymentStep} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Go-live date */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">Go-live date</div>
            <div className="dl-golive-input-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input
                type="date"
                className="dl-golive-date-input"
                value={local.goLiveDate ?? ""}
                onChange={(e) => setLocal((prev) => ({ ...prev, goLiveDate: e.target.value || undefined }))}
              />
              {local.goLiveDate && (
                <button
                  className="dl-golive-clear-btn"
                  onClick={() => setLocal((prev) => ({ ...prev, goLiveDate: undefined }))}
                  title="Clear date"
                >×</button>
              )}
            </div>
          </div>

          {/* Notes (editable) */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">Notes</div>
            <textarea
              className="dl-modal-notes-input"
              placeholder="Add notes…"
              value={local.note}
              onChange={(e) => setLocal((prev) => ({ ...prev, note: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Meta */}
          {local.invoiceNumber && (
            <div className="dl-meta">
              <span className="dl-meta-item">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {local.invoiceNumber}
              </span>
            </div>
          )}

          {/* Activity log */}
          {(local.activityLog?.length ?? 0) > 0 && (
            <div className="dl-modal-section">
              <div className="dl-modal-section-title">Activity</div>
              <div className="dl-activity-feed">
                {[...(local.activityLog ?? [])].reverse().slice(0, 8).map((entry, i) => (
                  <div key={i} className="dl-activity-entry">
                    <span className={`dl-activity-dot ${entry.type}`} />
                    <span className="dl-activity-msg">{entry.message}</span>
                    <span className="dl-activity-time">{fmtDate(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sheet sync setup hint */}
          {sheetState === "setup" && (
            <div className="dl-modal-setup-hint">
              <strong>Apps Script not configured.</strong> Add <code>APPS_SCRIPT_URL</code> to your Vercel env vars to enable sheet sync.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dl-modal-footer">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
            {onDelete && (
              <button
                className="dl-delete-card-btn"
                onClick={async () => {
                  if (!confirm("Delete this card? This can't be undone.")) return;
                  await onDelete();
                }}
                title="Delete this card"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Delete card
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="dl-footer-actions">
              {/* Save to Local — persists for all web app users */}
              <button
                className={`dl-save-local-btn ${saveState}`}
                onClick={handleSaveLocal}
                disabled={saveState === "saving"}
                title="Save changes for all web app users"
              >
                {saveState === "saving" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "dl-spin 0.8s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {saveState === "ok" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {saveState === "idle"   && "Save to Local"}
                {saveState === "saving" && "Saving…"}
                {saveState === "ok"     && "Saved ✓"}
                {saveState === "error"  && "Save failed"}
              </button>

              {/* Sync to Sheet — pushes to Google Sheets */}
              <button
                className={`dl-sync-sheet-btn ${sheetState}`}
                onClick={handleSyncToSheet}
                disabled={sheetState === "syncing"}
                title="Push changes to Google Sheet"
              >
                {sheetState === "syncing" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "dl-spin 0.8s linear infinite" }}>
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                )}
                {sheetState === "ok" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {sheetState === "idle"    && "Sync to Sheet"}
                {sheetState === "syncing" && "Syncing…"}
                {sheetState === "ok"      && "Synced ✓"}
                {sheetState === "error"   && "Sync failed"}
                {sheetState === "setup"   && "Setup needed"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Per-deliverable completion flow */}
      {completionTarget && (
        <CompletionFlowModal
          item={completionTarget.item}
          row={local}
          onConfirm={handleCompletionConfirm}
          onClose={() => setCompletionTarget(null)}
        />
      )}
    </div>
  );
}

// ── Completion Flow Modal ─────────────────────────────────────────────────────
function CompletionFlowModal({
  item, row, onConfirm, onClose,
}: {
  item: DeliverableItem;
  row: DeliverableRow;
  onConfirm: (url: string) => void;
  onClose: () => void;
}) {
  const isVideoType = /reel|video|short|yt\b/i.test(item.label);
  const [step, setStep]   = useState<"url" | "email">(isVideoType ? "url" : "email");
  const [url,  setUrl]    = useState(item.publishedUrl ?? "");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const type   = inferType(item.label);

  useEffect(() => {
    if (isVideoType) urlRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isVideoType]);

  // Non-video types: auto-generate the email immediately on mount
  useEffect(() => {
    if (isVideoType) return;
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const generated = generateEmailText({
      pocName: row.pocName,
      deliverableName: item.label,
      deliverableType: type,
      currentDate: today,
      liveUrl: "",
      creatorName: row.pocName,
      agencyName: row.pocCompany,
      allDeliverables: row.deliverables.map((d) => ({
        label: d.label,
        status: d.id === item.id ? "Completed" : d.status,
      })),
    });
    setEmail(generated);
    navigator.clipboard.writeText(generated).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGenerate() {
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const generated = generateEmailText({
      pocName: row.pocName,
      deliverableName: item.label,
      deliverableType: type,
      currentDate: today,
      liveUrl: url.trim(),
      creatorName: row.pocName,
      agencyName: row.pocCompany,
      allDeliverables: row.deliverables.map((d) => ({
        label: d.label,
        status: d.id === item.id ? "Completed" : d.status,
      })),
    });
    setEmail(generated);
    navigator.clipboard.writeText(generated).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    setStep("email");
  }

  function handleCopy() {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleGmail() {
    const subj = encodeURIComponent(`${item.label} – ${row.brand}`);
    const body = encodeURIComponent(email);
    const to   = "";
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subj}&body=${body}`, "_blank");
  }

  function handleOutlook() {
    const subj = encodeURIComponent(`${item.label} – ${row.brand}`);
    const body = encodeURIComponent(email);
    window.open(`https://outlook.live.com/mail/0/deeplink/compose?subject=${subj}&body=${body}`, "_blank");
  }

  return (
    <div className="modal-overlay dl-completion-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-completion-modal">

        {/* Header */}
        <div className="dl-completion-header">
          <div className="dl-completion-header-left">
            <span className="dl-completion-check-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div>
              <p className="dl-completion-title">Deliverable marked complete</p>
              <p className="dl-completion-subtitle">{item.label}</p>
            </div>
          </div>
          <button className="kanban-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="dl-completion-body">
          {step === "url" ? (
            <>
              <label className="dl-completion-label">
                Paste live URL
                <span className="dl-completion-optional"> (optional)</span>
              </label>
              <input
                ref={urlRef}
                className="dl-completion-url-input"
                type="url"
                placeholder="https://instagram.com/reel/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
              />
              <div className="dl-completion-actions">
                <button className="kanban-btn-secondary" onClick={onClose}>Cancel</button>
                <button className="dl-generate-email-btn" onClick={handleGenerate}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Generate Email
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="dl-email-preview-wrap">
                <div className="dl-email-preview-toolbar">
                  <span className="dl-email-preview-label">
                    {copied ? "✓ Auto-copied to clipboard" : "Draft email"}
                  </span>
                  <button className="dl-email-edit-btn" onClick={() => setStep("url")}>← Edit URL</button>
                </div>
                <pre className="dl-email-preview">{email}</pre>
              </div>

              <div className="dl-completion-actions dl-email-actions">
                <button className={`dl-copy-email-btn${copied ? " ok" : ""}`} onClick={handleCopy}>
                  {copied ? (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                  ) : (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Email</>
                  )}
                </button>
                <button className="dl-gmail-btn" onClick={handleGmail}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Open in Gmail
                </button>
                <button className="dl-outlook-btn" onClick={handleOutlook}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                  Outlook
                </button>
                <button className="dl-confirm-complete-btn" onClick={() => onConfirm(url.trim())}>
                  Confirm &amp; Save
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function DeliverableCard({
  row,
  search,
  modified,
  isLocal = false,
  onClick,
}: {
  row: DeliverableRow;
  search: string;
  modified: boolean;
  isLocal?: boolean;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[row.overallStatus];
  const hasCollab = row.deliverables.some((d) => /collab/i.test(d.label));
  const lsKey = `dl-adv-rcvd-${row.id}`;
  const completedKey = `dl-completed-${row.id}`;
  const [advRcvd, setAdvRcvd] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = localStorage.getItem(lsKey);
    return v === "true";
  });
  const [completed, setCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(completedKey) === "true";
  });

  function toggleAdv(e: React.MouseEvent) {
    e.stopPropagation();
    setAdvRcvd((prev) => {
      const next = !prev;
      localStorage.setItem(lsKey, String(next));
      return next;
    });
  }

  function toggleCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    setCompleted((prev) => {
      const next = !prev;
      localStorage.setItem(completedKey, String(next));
      return next;
    });
  }

  return (
    <div
      className="dl-card"
      data-status={row.overallStatus}
      data-completed={completed}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <div className="dl-card-stripe" data-status={row.overallStatus} />
      <div className="dl-card-inner">
        <div className="dl-card-header">
          <span className="dl-pn-badge">
            <span className="dl-pn-dot" data-status={row.overallStatus} />
            <Highlight text={row.pnNo.toUpperCase()} query={search} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {isLocal && <span className="dl-local-badge" title="Locally created card">Local</span>}
            {modified && !isLocal && <span className="dl-modified-dot" title="Locally modified" />}
            {hasCollab && (
              <span className="dl-collab-tag">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Collab
              </span>
            )}
            <span className="dl-status-pill" data-status={row.overallStatus}>
              {status.label}
            </span>
          </div>
        </div>

        <h3 className="dl-brand">
          <Highlight text={row.brand} query={search} />
        </h3>

        {row.deliverables.length > 0 && (
          <div className="dl-items">
            {row.deliverables.map((item, i) => {
              const done = item.status === "Completed";
              const isCollab = /collab/i.test(item.label);
              return (
                <span key={i} className={`dl-chip${isCollab ? " dl-chip-collab" : ""}`} data-done={done}>
                  <span className="dl-chip-dot" data-done={done} />
                  <span className="dl-chip-label">
                    <Highlight text={item.label} query={search} />
                  </span>
                  {isCollab && <span className="dl-chip-collab-dot" />}
                </span>
              );
            })}
          </div>
        )}

        <div className="dl-card-footer">
          {row.pocName && (
            <div className="dl-poc">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span className="dl-poc-name"><Highlight text={row.pocName} query={search} /></span>
              {row.pocCompany && <span className="dl-poc-company"><Highlight text={row.pocCompany} query={search} /></span>}
            </div>
          )}
          <div className="dl-payment">
            {PAYMENT_STEPS.map((step, i) => (
              <div key={step} className="dl-payment-step">
                <div className="dl-payment-dot" style={i < row.paymentStep ? { background: "#22c55e", borderColor: "#22c55e" } : {}}>
                  {i < row.paymentStep && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="dl-payment-label" data-active={i < row.paymentStep}>{step}</span>
                {i < PAYMENT_STEPS.length - 1 && <div className="dl-payment-line" data-active={i + 1 <= row.paymentStep} />}
              </div>
            ))}
          </div>
        </div>

        {(row.invoiceNumber || row.note) && (
          <div className="dl-meta">
            {row.invoiceNumber && (
              <span className="dl-meta-item">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {row.invoiceNumber}
              </span>
            )}
            {row.note && (
              <span className="dl-meta-item dl-note" title={row.note}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <Highlight text={row.note} query={search} />
              </span>
            )}
          </div>
        )}

        {/* Go-live date badge */}
        {row.goLiveDate && (
          <div className="dl-golive-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="dl-golive-label">Go live</span>
            <span className="dl-golive-date">{new Date(row.goLiveDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
        )}

        {/* Advance received — independent of payment pipeline */}
        <button
          className="dl-advance-check"
          data-checked={advRcvd}
          onClick={toggleAdv}
          title={advRcvd ? "Advance received ✓" : "Mark advance as received"}
        >
          <span className="dl-advance-box">
            {advRcvd && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span className="dl-advance-label">Advance received</span>
        </button>

        {/* Completed button */}
        <button
          className="dl-completed-btn"
          data-completed={completed}
          onClick={toggleCompleted}
        >
          <span className="dl-completed-icon">
            {completed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span className="dl-completed-label">
            {completed ? "Deliverable Completed" : "Mark as Completed"}
          </span>
          {completed && <span className="dl-completed-undo">undo</span>}
        </button>

        {/* Tap hint on mobile */}
        <div className="dl-card-tap-hint">Tap to open</div>
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
type FilterTab = "all" | "pending" | "in-progress" | "awaiting-payment" | "done";
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in-progress", label: "In Progress" },
  { key: "awaiting-payment", label: "Awaiting" },
  { key: "done", label: "Done" },
];

// ── Main view ─────────────────────────────────────────────────────────────────
export function DeliverablesView() {
  const permission = usePermission("deliverables");
  const canEdit = permission === "edit";
  const [data, setData] = useState<DeliverableRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, DeliverableRow>>({});
  const [localRows, setLocalRows] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [month, setMonth] = useState("all");
  const [talent, setTalent] = useState("all");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [collabOnly, setCollabOnly] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");
  const searchRef = useRef<HTMLInputElement>(null);
  const prevDataRef = useRef<string>("");

  // Merge overrides + localRows into data for display.
  // For goLiveDate: sheet value is the source of truth; override only wins if explicitly set.
  const displayData = useMemo(() => {
    const mergeRow = (row: DeliverableRow): DeliverableRow => {
      const ov = overrides[row.id];
      if (!ov) return row;
      return {
        ...ov,
        // Sheet's goLiveDate is the source of truth — always wins over override.
        // Only fall back to override's date if the sheet has no date.
        goLiveDate: row.goLiveDate ?? ov.goLiveDate,
      };
    };
    const sheetRows = data.map(mergeRow);
    const localWithOverrides = localRows.map(mergeRow);
    return [...localWithOverrides, ...sheetRows];
  }, [data, overrides, localRows]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true);
    setError(null);
    try {
      const [sheetRes, overridesEnv, localRowsEnv] = await Promise.all([
        fetch("/api/deliverables", { cache: "no-store" }),
        fetch("/api/sync/deliverable-overrides", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/sync/deliverable-local-rows", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      const json = await sheetRes.json();

      if (!sheetRes.ok) {
        if (json.error === "sheet_private") {
          setError("sheet_private");
        } else {
          throw new Error(json.error ?? "Failed");
        }
        return;
      }

      const next: DeliverableRow[] = json.deliverables ?? [];
      const nextStr = JSON.stringify(next);
      if (silent && nextStr !== prevDataRef.current) {
        setLiveIndicator(true);
        setTimeout(() => setLiveIndicator(false), 2000);
      }
      prevDataRef.current = nextStr;
      setData(next);

      // Overlay server-side overrides so all users see the same saved state.
      // Self-heal: if the sheet now provides a goLiveDate, remove any stale
      // goLiveDate from the override so the sheet value always wins.
      if (overridesEnv?.data && typeof overridesEnv.data === "object") {
        const rawOverrides = overridesEnv.data as Record<string, DeliverableRow>;
        const sheetById = Object.fromEntries(next.map((r) => [r.id, r]));
        let didHeal = false;
        const healedOverrides = Object.fromEntries(
          Object.entries(rawOverrides).map(([id, ov]) => {
            const sheetRow = sheetById[id];
            if (sheetRow?.goLiveDate && ov.goLiveDate && ov.goLiveDate !== sheetRow.goLiveDate) {
              // Sheet has a date that differs — drop the stale override date
              const { goLiveDate: _dropped, ...rest } = ov;
              didHeal = true;
              return [id, rest as DeliverableRow];
            }
            return [id, ov];
          })
        );
        setOverrides(healedOverrides);
        // Persist the healed overrides back to Redis so the fix survives page reload
        if (didHeal) {
          fetch("/api/sync/deliverable-overrides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(healedOverrides),
          }).catch(() => {/* non-critical */});
        }
      }

      // Load locally-created rows
      if (Array.isArray(localRowsEnv?.data)) {
        setLocalRows(localRowsEnv.data as DeliverableRow[]);
      }

      setLastFetched(new Date());
    } catch {
      if (!silent) setError("Could not load deliverables.");
    } finally {
      setLoading(false); setSyncing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch(""); searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const months = useMemo(() => {
    const seen = new Set<string>();
    displayData.forEach((d) => { if (d.month) seen.add(d.month); });
    return ["all", ...Array.from(seen)];
  }, [displayData]);

  const talents = useMemo(() => {
    const seen = new Set<string>();
    displayData.forEach((d) => { if (d.pocName) seen.add(d.pocName); });
    return ["all", ...Array.from(seen).sort()];
  }, [displayData]);

  const collabCount = useMemo(() =>
    displayData.filter((r) => r.deliverables.some((d) => /collab/i.test(d.label))).length,
    [displayData]
  );

  // Count how many cards match each hardcoded agency chip
  const agencyCounts = useMemo(() => {
    const c: Record<string, number> = {};
    AGENCY_CHIPS.forEach((a) => { c[a] = displayData.filter((r) => matchesAgency(r, a)).length; });
    return c;
  }, [displayData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return displayData.filter((row) => {
      if (filter !== "all" && row.overallStatus !== filter) return false;
      if (month !== "all" && row.month !== month) return false;
      if (talent !== "all" && row.pocName !== talent) return false;
      if (agencyFilter && !matchesAgency(row, agencyFilter)) return false;
      if (collabOnly && !row.deliverables.some((d) => /collab/i.test(d.label))) return false;
      if (q) return (
        row.brand.toLowerCase().includes(q) ||
        row.pnNo.toLowerCase().includes(q) ||
        row.poc.toLowerCase().includes(q) ||
        row.deliverables.some((d) => d.label.toLowerCase().includes(q)) ||
        row.note.toLowerCase().includes(q)
      );
      return true;
    });
  }, [displayData, filter, month, talent, agencyFilter, collabOnly, search]);

  function copyPaymentSummary() {
    const rows = filtered.filter((r) => r.overallStatus === "awaiting-payment");
    if (!rows.length) return;
    const lines = rows.map((r) => {
      const dlList = r.deliverables.map((d) => `  • ${d.label}`).join("\n");
      return `${r.pnNo.toUpperCase()} — ${r.brand}\n${dlList}${r.pocName ? `\n  Contact: ${r.pocName}` : ""}`;
    });
    const text = `Awaiting Payment (${rows.length})\n${"─".repeat(40)}\n${lines.join("\n\n")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 2000);
    });
  }

  const counts = useMemo(() => {
    const c = { pending: 0, "in-progress": 0, "awaiting-payment": 0, done: 0 };
    displayData.forEach((d) => { c[d.overallStatus]++; });
    return c;
  }, [displayData]);

  const selectedRow = selectedId ? (displayData.find((r) => r.id === selectedId) ?? null) : null;

  async function handleSave(updated: DeliverableRow) {
    const next = (prev: Record<string, DeliverableRow>) => ({ ...prev, [updated.id]: updated });
    setOverrides(next);
    // Persist to Redis so all web app users see the updated state
    const currentOverrides = { ...overrides, [updated.id]: updated };
    await fetch("/api/sync/deliverable-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentOverrides),
    });
  }

  async function handleCreate(row: DeliverableRow) {
    const next = [row, ...localRows];
    setLocalRows(next);
    await fetch("/api/sync/deliverable-local-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function handleDelete(id: string) {
    const next = localRows.filter((r) => r.id !== id);
    setLocalRows(next);
    setSelectedId(null);
    await fetch("/api/sync/deliverable-local-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  return (
    <div className="dl-page" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

      {/* Page header */}
      <div className="dl-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="dl-heading">Deliverables</h2>
            <span className={`dl-live-badge ${liveIndicator ? "flash" : ""}`}>
              <span className="dl-live-dot" />LIVE
            </span>
          </div>
          <p className="dl-subheading">
            {loading ? "Syncing from Google Sheets…" : `${filtered.length} of ${displayData.length} deliverables`}
            {lastFetched && !loading && (
              <span className="dl-last-fetched"> · synced {lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canEdit && (
            <button className="dl-new-card-btn" onClick={() => setShowCreate(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New card
            </button>
          )}
          <button className="kanban-btn-secondary dl-refresh-btn" onClick={() => load(false)} disabled={loading || syncing}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: (loading || syncing) ? "dl-spin 0.8s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {syncing ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Agency quick-filter chips */}
      {!loading && (
        <div className="dl-agency-chips">
          {AGENCY_CHIPS.map((agency) => (
            <button
              key={agency}
              className={`dl-agency-chip ${agencyFilter === agency ? "active" : ""}`}
              onClick={() => setAgencyFilter(agencyFilter === agency ? "" : agency)}
            >
              <span className="dl-agency-chip-avatar">
                {agency.charAt(0).toUpperCase()}
              </span>
              <span className="dl-agency-chip-name">{agency}</span>
              <span className="dl-agency-chip-count">{agencyCounts[agency] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status strip */}
      {!loading && displayData.length > 0 && (
        <div className="dl-stats-strip">
          {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => (
            <button key={key}
              className={`dl-stat-pill ${filter === key ? "active" : ""}`}
              data-status={key}
              onClick={() => setFilter(filter === key ? "all" : key as FilterTab)}
            >
              <span className="dl-stat-dot" data-status={key} />
              {cfg.label}
              <span className="dl-stat-count">{counts[key]}</span>
            </button>
          ))}
          {collabCount > 0 && (
            <button
              className={`dl-stat-pill dl-stat-pill-collab ${collabOnly ? "active" : ""}`}
              onClick={() => setCollabOnly((v) => !v)}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Collab
              <span className="dl-stat-count">{collabCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="dl-controls">
        <div className="dl-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input ref={searchRef} className="dl-search" placeholder="Search brand, PN, contact… (⌘F)"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button className="dl-search-clear" onClick={() => { setSearch(""); searchRef.current?.focus(); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {search && !loading && <span className="dl-search-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>}
        {months.length > 2 && (
          <select className="dl-month-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m === "all" ? "All months" : m}</option>)}
          </select>
        )}
        {talents.length > 2 && (
          <select className="dl-month-select" value={talent} onChange={(e) => setTalent(e.target.value)} title="Filter by creator/talent">
            {talents.map((t) => <option key={t} value={t}>{t === "all" ? "All creators" : t}</option>)}
          </select>
        )}
        {filter === "awaiting-payment" && counts["awaiting-payment"] > 0 && (
          <button
            className={`dl-copy-payment-btn ${copyState === "ok" ? "ok" : ""}`}
            onClick={copyPaymentSummary}
            title="Copy payment summary to clipboard"
          >
            {copyState === "ok" ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy {counts["awaiting-payment"]} payment{counts["awaiting-payment"] !== 1 ? "s" : ""}
              </>
            )}
          </button>
        )}
        <div className="dl-filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button key={tab.key} className={`dl-filter-tab ${filter === tab.key ? "active" : ""}`}
              onClick={() => setFilter(tab.key)}>{tab.label}</button>
          ))}
        </div>
      </div>

      {loading && <div className="dl-loading"><div className="dl-spinner" /><span>Syncing from Google Sheets…</span></div>}
      {error && !loading && (
        <div className="dl-error">
          {error === "sheet_private" ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Google Sheet is private</p>
              <p style={{ fontSize: 13, color: "var(--app-text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                Open the sheet → <strong>Share</strong> → change access to{" "}
                <strong>&ldquo;Anyone with the link&rdquo; → Viewer</strong>, then refresh below.
              </p>
              <a
                href={`https://docs.google.com/spreadsheets/d/1PImkkw3DEsbZ8Vaveqmc-nyPkP_xQhoAGfesPeE1_fY/edit#gid=1182035153`}
                target="_blank"
                rel="noopener noreferrer"
                className="kanban-btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 10 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open Google Sheet
              </a>
              <br />
              <button className="kanban-btn-primary" onClick={() => load()} style={{ marginTop: 6 }}>
                Retry
              </button>
            </>
          ) : (
            <>
              <p>{error}</p>
              <button className="kanban-btn-primary" onClick={() => load()}>Try again</button>
            </>
          )}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && localRows.length === 0 && (
        <div className="dl-empty">
          <div className="dl-empty-icon">📋</div>
          <h3>No deliverables found</h3>
          <p>{search || filter !== "all" ? "Try adjusting your filters" : "No data in the sheet"}</p>
          {canEdit && (
            <button className="kanban-btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
              + Add your first card
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="dl-grid">
          {filtered.map((row) => (
            <DeliverableCard
              key={row.id}
              row={row}
              search={search}
              modified={!!overrides[row.id]}
              isLocal={row.id.startsWith("local-")}
              onClick={() => setSelectedId(row.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDeliverableModal
          allRows={displayData}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {selectedRow && (
        <DeliverableModal
          row={selectedRow}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          onDelete={selectedRow.id.startsWith("local-") ? () => handleDelete(selectedRow.id) : undefined}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}
