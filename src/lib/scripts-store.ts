/**
 * Scripts storage — backed by Upstash Redis.
 * Key: studio:scripts  (array of Script objects)
 */
import { dataGet, dataSet } from "@/lib/data-store";

export interface Script {
  id: string;
  title: string;
  doc_url: string | null;
  sender_name: string;
  sender_email: string;
  received_at: string;       // ISO 8601
  status: "pending" | "approved";
  approved_at: string | null;
  approved_by: string | null;
  gmail_message_id: string;  // deduplication key
}

const KEY = "studio:scripts";

export async function getScripts(): Promise<Script[]> {
  const scripts = (await dataGet<Script[]>(KEY)) ?? [];
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
