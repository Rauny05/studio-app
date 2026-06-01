/**
 * Scripts storage — backed by Upstash Redis.
 * Key: studio:scripts  (array of Script objects)
 */
import { dataGet, dataSet } from "@/lib/data-store";

export interface ScriptDoc {
  id: string;
  name: string;        // Script/doc name extracted from email
  doc_url: string;     // Google Docs URL
  status: "pending" | "approved";
  approved_at: string | null;
  approved_by: string | null;
}

export interface Script {
  id: string;
  title: string;
  docs: ScriptDoc[];         // Multiple scripts per email
  sender_name: string;
  sender_email: string;
  received_at: string;       // ISO 8601
  status: "pending" | "approved"; // approved when ALL docs approved
  approved_at: string | null;
  approved_by: string | null;
  gmail_message_id: string;  // deduplication key
  // Legacy fallback
  doc_url?: string | null;
}

const KEY = "studio:scripts";

export async function getScripts(): Promise<Script[]> {
  const raw = (await dataGet<Script[]>(KEY)) ?? [];
  // Migrate legacy scripts that have doc_url but no docs array
  const scripts = raw.map((s) => {
    if (!s.docs || s.docs.length === 0) {
      return {
        ...s,
        docs: s.doc_url ? [{
          id: `${s.id}-doc-0`,
          name: s.title,
          doc_url: s.doc_url,
          status: s.status,
          approved_at: s.approved_at,
          approved_by: s.approved_by,
        }] : [],
      } as Script;
    }
    return s;
  });
  return scripts.sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  );
}

export async function addScript(script: Script): Promise<{ added: boolean }> {
  const scripts = (await dataGet<Script[]>(KEY)) ?? [];

  // Deduplicate by gmail_message_id
  if (scripts.some((s) => s.gmail_message_id === script.gmail_message_id)) {
    return { added: false };
  }

  scripts.push(script);
  await dataSet(KEY, scripts);
  return { added: true };
}

export async function updateScriptDoc(
  scriptId: string,
  docId: string,
  status: "pending" | "approved",
  approvedBy: string | null,
): Promise<Script | null> {
  const scripts = (await dataGet<Script[]>(KEY)) ?? [];
  const idx = scripts.findIndex((s) => s.id === scriptId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const updatedDocs: ScriptDoc[] = scripts[idx].docs.map((d) =>
    d.id === docId
      ? { ...d, status, approved_at: status === "approved" ? now : null, approved_by: status === "approved" ? approvedBy : null }
      : d
  );

  // Overall script approved when all docs approved
  const allApproved = updatedDocs.length > 0 && updatedDocs.every((d) => d.status === "approved");

  scripts[idx] = {
    ...scripts[idx],
    docs: updatedDocs,
    status: allApproved ? "approved" : "pending",
    approved_at: allApproved ? now : null,
    approved_by: allApproved ? approvedBy : null,
  };

  await dataSet(KEY, scripts);
  return scripts[idx];
}

export async function updateScript(
  id: string,
  updates: Partial<Pick<Script, "status" | "approved_at" | "approved_by">>
): Promise<Script | null> {
  const scripts = (await dataGet<Script[]>(KEY)) ?? [];
  const idx = scripts.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  scripts[idx] = { ...scripts[idx], ...updates };
  await dataSet(KEY, scripts);
  return scripts[idx];
}
