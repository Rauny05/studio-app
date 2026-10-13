import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSheetRow } from "../src/lib/deliverable-merge.ts";

const base = {
  emailSent: false, advance50: false, payment100: false, invoiceNumber: "", note: "",
  paymentStep: 0 as const, month: "Sep 2026",
};

test("sheet wins on deliverable list, brand and POC; saved completion carries over by label", () => {
  const sheet = {
    ...base, id: "se26-27", pnNo: "se26-27", brand: "vivo X Fold6", poc: "Momentum - NAIM",
    pocName: "Momentum", pocCompany: "NAIM", overallStatus: "pending" as const,
    deliverables: [{ label: "1 IG reel", status: "Pending" as const }],
  };
  const stale = {
    ...sheet, brand: "OLD BRAND", pocName: "Old", overallStatus: "done" as const, payment100: true, note: "kept",
    deliverables: [
      { label: "2 IG reels", status: "Completed" as const },
      { label: "1 ig REEL ", status: "Completed" as const, completedBy: "a@b.c" },
    ],
  };
  const m = mergeSheetRow(sheet, stale);
  assert.equal(m.brand, "vivo X Fold6");
  assert.equal(m.pocName, "Momentum");
  assert.deepEqual(m.deliverables.map((d) => d.label), ["1 IG reel"]);
  assert.equal(m.deliverables[0].status, "Completed");
  assert.equal(m.deliverables[0].completedBy, "a@b.c");
  assert.equal(m.note, "kept");
  assert.equal(m.overallStatus, "done");
});

test("a new sheet deliverable with no saved state appears as the sheet says", () => {
  const sheet = { ...base, id: "x", pnNo: "x", brand: "B", poc: "", pocName: "", pocCompany: "",
    overallStatus: "pending" as const, deliverables: [{ label: "New", status: "Pending" as const }] };
  const m = mergeSheetRow(sheet, { ...sheet, deliverables: [] });
  assert.equal(m.deliverables[0].status, "Pending");
  assert.equal(m.overallStatus, "pending");
});

test("no saved copy returns the sheet row untouched", () => {
  const sheet = { ...base, id: "y", pnNo: "y", brand: "B", poc: "", pocName: "", pocCompany: "",
    overallStatus: "pending" as const, deliverables: [] };
  assert.equal(mergeSheetRow(sheet, undefined), sheet);
});
