"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { DeliverableRow, DeliverableItem } from "@/app/api/deliverables/route";
import { usePermission } from "@/hooks/use-permission";

const POLL_INTERVAL = 30_000;

const STATUS_CONFIG = {
  pending:           { label: "Pending",          stripeColor: "#737373" },
  "in-progress":     { label: "In Progress",      stripeColor: "#f59e0b" },
  "awaiting-payment":{ label: "Awaiting Payment", stripeColor: "#3b82f6" },
  done:              { label: "Done",             stripeColor: "#22c55e" },
};

const PAYMENT_STEPS = ["Email", "50%", "Paid"];

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

// ── Deliverable Modal ─────────────────────────────────────────────────────────
function DeliverableModal({
  row,
  onClose,
  onSave,
  readOnly = false,
}: {
  row: DeliverableRow;
  onClose: () => void;
  onSave: (updated: DeliverableRow) => Promise<void>;
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState<DeliverableRow>({ ...row, deliverables: row.deliverables.map((d) => ({ ...d })) });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [sheetState, setSheetState] = useState<"idle" | "syncing" | "ok" | "error" | "setup">("idle");
  const [newDel, setNewDel] = useState("");
  const newDelRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

          {/* Deliverable chips — tappable yellow → green */}
          <div className="dl-modal-section">
            <div className="dl-modal-section-title">
              Deliverables
              <span className="dl-modal-section-hint">
                {allDone ? "✓ All done" : "Tap to mark done"}
              </span>
            </div>
            <div className="dl-modal-chips">
              {local.deliverables.map((item, i) => {
                const done = item.status === "Completed";
                return (
                  <button
                    key={i}
                    className={`dl-modal-chip ${done ? "done" : "pending"}`}
                    onClick={() => { if (!readOnly) toggleChip(i); }}
                    disabled={readOnly}
                    title={readOnly ? item.label : done ? "Mark as pending" : "Mark as done"}
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
                    {!readOnly && (
                      <span
                        className="dl-chip-remove"
                        role="button"
                        aria-label="Remove"
                        onClick={(e) => { e.stopPropagation(); removeChip(i); }}
                      >×</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Add new deliverable — hidden in readOnly */}
            {!readOnly && (
              <div className="dl-modal-add-row">
                <input
                  ref={newDelRef}
                  className="dl-modal-add-input"
                  placeholder="Add deliverable…"
                  value={newDel}
                  onChange={(e) => setNewDel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addDeliverable(); }}
                />
                <button
                  className="dl-modal-add-btn"
                  onClick={addDeliverable}
                  disabled={!newDel.trim()}
                >
                  + Add
                </button>
              </div>
            )}
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

          {/* Sheet sync setup hint */}
          {sheetState === "setup" && (
            <div className="dl-modal-setup-hint">
              <strong>Apps Script not configured.</strong> Add <code>APPS_SCRIPT_URL</code> to your Vercel env vars to enable sheet sync.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dl-modal-footer">
          <button className="kanban-btn-secondary" onClick={onClose}>
            Cancel
          </button>

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
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function DeliverableCard({
  row,
  search,
  modified,
  onClick,
}: {
  row: DeliverableRow;
  search: string;
  modified: boolean;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[row.overallStatus];
  const hasCollab = row.deliverables.some((d) => /collab/i.test(d.label));
  const lsKey = `dl-adv-rcvd-${row.id}`;
  const [advRcvd, setAdvRcvd] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = localStorage.getItem(lsKey);
    return v === "true";
  });

  function toggleAdv(e: React.MouseEvent) {
    e.stopPropagation();
    setAdvRcvd((prev) => {
      const next = !prev;
      localStorage.setItem(lsKey, String(next));
      return next;
    });
  }

  return (
    <div
      className="dl-card"
      data-status={row.overallStatus}
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
            {modified && <span className="dl-modified-dot" title="Locally modified" />}
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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [month, setMonth] = useState("all");
  const [talent, setTalent] = useState("all");
  const [collabOnly, setCollabOnly] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");
  const searchRef = useRef<HTMLInputElement>(null);
  const prevDataRef = useRef<string>("");

  // Merge overrides into data for display
  const displayData = useMemo(() =>
    data.map((row) => overrides[row.id] ?? row),
    [data, overrides]
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true);
    setError(null);
    try {
      const [sheetRes, overridesEnv] = await Promise.all([
        fetch("/api/deliverables", { cache: "no-store" }),
        fetch("/api/sync/deliverable-overrides", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
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

      // Overlay server-side overrides so all users see the same saved state
      if (overridesEnv?.data && typeof overridesEnv.data === "object") {
        setOverrides(overridesEnv.data as Record<string, DeliverableRow>);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return displayData.filter((row) => {
      if (filter !== "all" && row.overallStatus !== filter) return false;
      if (month !== "all" && row.month !== month) return false;
      if (talent !== "all" && row.pocName !== talent) return false;
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
  }, [displayData, filter, month, talent, collabOnly, search]);

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
        <button className="kanban-btn-secondary dl-refresh-btn" onClick={() => load(false)} disabled={loading || syncing}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: (loading || syncing) ? "dl-spin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

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
      {!loading && !error && filtered.length === 0 && (
        <div className="dl-empty">
          <div className="dl-empty-icon">📋</div>
          <h3>No deliverables found</h3>
          <p>{search || filter !== "all" ? "Try adjusting your filters" : "No data in the sheet"}</p>
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
              onClick={() => setSelectedId(row.id)}
            />
          ))}
        </div>
      )}

      {selectedRow && (
        <DeliverableModal
          row={selectedRow}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}
