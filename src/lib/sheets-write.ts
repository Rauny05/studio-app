import { SignJWT, importPKCS8 } from "jose";
import type { DeliverableItem, DeliverableRow } from "@/app/api/deliverables/route";
import { findNewlyCompleted } from "@/lib/deliverable-diff";

// Same sheet + tab the app reads from (src/app/api/deliverables/route.ts) —
// the "copy" tab, never the master. Writing here mirrors what's already
// read, so it can never touch a tab the app doesn't already depend on.
const SHEET_ID = "1PImkkw3DEsbZ8Vaveqmc-nyPkP_xQhoAGfesPeE1_fY";
const SHEET_GID = 1182035153;
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const YELLOW = { red: 1, green: 0.92, blue: 0.23 };
const FETCH_TIMEOUT_MS = 8000;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function getServiceAccount(): ServiceAccountKey | null {
  const raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed as ServiceAccountKey;
  } catch {
    console.error("[sheets-write] GOOGLE_SHEETS_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

async function getAccessToken(account: ServiceAccountKey): Promise<string> {
  const key = await importPKCS8(account.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

let cachedTabTitle: string | null = null;

async function getTabTitle(token: string): Promise<string> {
  if (cachedTabTitle) return cachedTabTitle;
  const res = await fetch(`${SHEETS_API}/${SHEET_ID}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Failed to read sheet metadata: ${res.status}`);
  const data = (await res.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
  const match = data.sheets.find((s) => s.properties.sheetId === SHEET_GID);
  if (!match) throw new Error(`No tab found with gid ${SHEET_GID}`);
  cachedTabTitle = match.properties.title;
  return cachedTabTitle;
}

function rangeUrl(title: string, a1Range: string) {
  return `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(`'${title}'!${a1Range}`)}`;
}

/**
 * Marks a deliverable item "Completed" in the copy-sheet's deliverables cell
 * and highlights the whole row yellow, so completions done in the app are
 * visible at a glance when someone opens the sheet. Best-effort — Redis
 * already holds the source of truth for completion, so a failure here must
 * never surface to the caller or block the save that already succeeded.
 */
export async function markCompletedInSheet(row: DeliverableRow, item: DeliverableItem) {
  const account = getServiceAccount();
  if (!account) {
    console.error("[sheets-write] GOOGLE_SHEETS_SERVICE_ACCOUNT not configured, skipping sheet write");
    return;
  }

  try {
    const token = await getAccessToken(account);
    const title = await getTabTitle(token);

    // Locate the row by PN number (column A) — same row order the CSV export uses.
    const colARes = await fetch(rangeUrl(title, "A:A"), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!colARes.ok) throw new Error(`Failed to read column A: ${colARes.status}`);
    const colAData = (await colARes.json()) as { values?: string[][] };
    const values = colAData.values ?? [];
    const rowIndex = values.findIndex((r) => (r[0] ?? "").trim() === row.pnNo.trim());
    if (rowIndex === -1) {
      console.error(`[sheets-write] Row not found for pnNo "${row.pnNo}", skipping`);
      return;
    }
    const sheetRow = rowIndex + 1; // 1-indexed A1 row number

    // Read the current deliverables cell (column C) and flip the matching line.
    const cellRes = await fetch(rangeUrl(title, `C${sheetRow}`), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!cellRes.ok) throw new Error(`Failed to read deliverables cell: ${cellRes.status}`);
    const cellData = (await cellRes.json()) as { values?: string[][] };
    const currentText = cellData.values?.[0]?.[0] ?? "";

    let matched = false;
    const updatedLines = currentText.split("\n").map((line) => {
      const label = line.replace(/\s*-\s*(Pending|Completed)\s*$/i, "").trim();
      if (label.toLowerCase() === item.label.trim().toLowerCase()) {
        matched = true;
        return `${label} - Completed`;
      }
      return line;
    });
    if (!matched) {
      console.error(`[sheets-write] Deliverable line "${item.label}" not found in row ${sheetRow}, skipping`);
      return;
    }

    const updateRes = await fetch(`${rangeUrl(title, `C${sheetRow}`)}?valueInputOption=RAW`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[updatedLines.join("\n")]] }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!updateRes.ok) throw new Error(`Failed to update cell: ${updateRes.status} ${await updateRes.text()}`);

    // Highlight the whole row yellow so the change is visible at a glance.
    const formatRes = await fetch(`${SHEETS_API}/${SHEET_ID}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: SHEET_GID,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 0,
                endColumnIndex: 10,
              },
              cell: { userEnteredFormat: { backgroundColor: YELLOW } },
              fields: "userEnteredFormat.backgroundColor",
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!formatRes.ok) {
      console.error(`[sheets-write] Failed to highlight row ${sheetRow}: ${formatRes.status} ${await formatRes.text()}`);
    }
  } catch (err) {
    console.error(`[sheets-write] Failed to mark "${item.label}" completed in sheet for ${row.pnNo}:`, err);
  }
}

export async function markNewlyCompletedInSheet(
  previousOverrides: Record<string, DeliverableRow>,
  newOverrides: Record<string, DeliverableRow>
) {
  const completed = findNewlyCompleted(previousOverrides, newOverrides);
  await Promise.allSettled(completed.map(({ row, item }) => markCompletedInSheet(row, item)));
}
