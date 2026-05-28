/**
 * Studio App — Deliverables Reverse Sync
 * ─────────────────────────────────────────
 * Deploy this as a Google Apps Script Web App to enable
 * "Sync to Sheet" from the Studio deliverables view.
 *
 * Setup:
 *   1. Open your Google Sheet → Extensions → Apps Script
 *   2. Paste this entire file, replacing any existing code
 *   3. Click Deploy → New Deployment → Web App
 *      • Execute as: Me
 *      • Who has access: Anyone
 *   4. Copy the web app URL
 *   5. In Vercel: add env var  APPS_SCRIPT_URL = <paste URL>
 *   6. Redeploy on Vercel
 *
 * Column layout expected (adjust COLS if your sheet differs):
 *   A = PN No      B = Brand      C = Deliverables
 *   D = POC        E = Email Sent  F = 50% Advance
 *   G = 100% Paid  H = Invoice No  I = Note
 */

const SHEET_NAME = "copy of 2025 Apr Onwards"; // ← change if needed

const COLS = {
  pnNo:          1, // A
  brand:         2, // B
  deliverables:  3, // C
  poc:           4, // D
  emailSent:     5, // E
  advance50:     6, // F
  payment100:    7, // G
  invoiceNumber: 8, // H
  note:          9, // I
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return json({ error: "Sheet not found: " + SHEET_NAME });
    }

    const values = sheet.getDataRange().getValues();

    // Find row by pnNo (column A, index 0)
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim().toLowerCase() === String(data.pnNo).trim().toLowerCase()) {
        rowIndex = i + 1; // 1-indexed for sheet range
        break;
      }
    }

    if (rowIndex === -1) {
      // Row not found — append as new row
      const newRow = new Array(Math.max(...Object.values(COLS))).fill("");
      newRow[COLS.pnNo - 1]          = data.pnNo;
      newRow[COLS.brand - 1]         = data.brand;
      newRow[COLS.deliverables - 1]  = buildDeliverablesText(data.deliverables);
      newRow[COLS.emailSent - 1]     = data.emailSent ? "Yes" : "No";
      newRow[COLS.advance50 - 1]     = data.advance50 ? "Yes" : "No";
      newRow[COLS.payment100 - 1]    = data.payment100 ? "Yes" : "No";
      newRow[COLS.invoiceNumber - 1] = data.invoiceNumber || "";
      newRow[COLS.note - 1]          = data.note || "";
      sheet.appendRow(newRow);
      return json({ ok: true, action: "inserted" });
    }

    // Update existing row
    sheet.getRange(rowIndex, COLS.deliverables).setValue(buildDeliverablesText(data.deliverables));
    sheet.getRange(rowIndex, COLS.emailSent).setValue(data.emailSent ? "Yes" : "No");
    sheet.getRange(rowIndex, COLS.advance50).setValue(data.advance50 ? "Yes" : "No");
    sheet.getRange(rowIndex, COLS.payment100).setValue(data.payment100 ? "Yes" : "No");
    if (data.invoiceNumber) sheet.getRange(rowIndex, COLS.invoiceNumber).setValue(data.invoiceNumber);
    if (data.note !== undefined) sheet.getRange(rowIndex, COLS.note).setValue(data.note);

    return json({ ok: true, action: "updated", row: rowIndex });

  } catch (err) {
    return json({ error: err.toString() });
  }
}

/** Format deliverables array back into the multi-line cell format */
function buildDeliverablesText(deliverables) {
  if (!deliverables || !deliverables.length) return "";
  return deliverables.map(function(d) {
    return d.label + " - " + d.status;
  }).join("\n");
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Required: handle GET so the deploy URL is pingable */
function doGet() {
  return json({ ok: true, service: "studio-sync" });
}
