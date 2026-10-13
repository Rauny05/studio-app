import type { DeliverableItem, DeliverableRow } from "@/app/api/deliverables/route";

function computeOverallStatus(deliverables: DeliverableItem[], payment100: boolean): DeliverableRow["overallStatus"] {
  if (!deliverables.length) return "pending";
  const allDone = deliverables.every((d) => d.status === "Completed");
  if (allDone && payment100) return "done";
  if (allDone) return "awaiting-payment";
  if (deliverables.some((d) => d.status === "Completed")) return "in-progress";
  return "pending";
}

/**
 * Sheet owns the deliverable list, brand and POC so sheet edits always show.
 * The saved override only contributes per-item completion state (matched by
 * label) plus payment/note fields.
 */
export function mergeSheetRow(row: DeliverableRow, ov: DeliverableRow | undefined): DeliverableRow {
  if (!ov) return row;
  const key = (label: string) => label.trim().toLowerCase();
  const savedByLabel = new Map((ov.deliverables ?? []).map((d) => [key(d.label), d]));
  const deliverables = row.deliverables.map((d) => {
    const saved = savedByLabel.get(key(d.label));
    return saved ? { ...d, ...saved, label: d.label } : d;
  });
  return {
    ...ov,
    id: row.id,
    pnNo: row.pnNo,
    brand: row.brand,
    poc: row.poc,
    pocName: row.pocName,
    pocCompany: row.pocCompany,
    month: row.month,
    deliverables,
    overallStatus: computeOverallStatus(deliverables, ov.payment100),
    goLiveDate: row.goLiveDate ?? ov.goLiveDate,
  };
}
