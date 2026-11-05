import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { isResponse, requireUser } from "@/cc/server/auth";
import { redact } from "@/cc/lib/redact";
import { readState, writeState } from "@/cc/server/state";

const SYSTEM = `You are Studio AI inside RM Studio Command Center.
Use ONLY the JSON context provided. If the answer is not in it, say you do not have that data. Never invent records, dates, people or amounts.
Be brief and concrete. Reference items by their titles.`;

const TASKS: Record<string, string> = {
  briefing: "Write a short daily briefing: what needs attention first, what is scheduled, what to work on next. Max 8 bullet points.",
  ask: "Answer the user's question from the context.",
  "email-actions": `Summarize the email thread in 2 sentences and extract action items. Reply ONLY as JSON: {"summary": string, "actions": [{"title": string, "due": "YYYY-MM-DD"|null, "reason": string}]}.`,
  brief: "Write a shoot brief: objective, key shots, talking points, prep checklist. Use only supplied facts and mark unknowns as TBD.",
};

async function bumpUsage() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const cur = ((await readState("ai-usage"))?.data ?? {}) as Record<string, number>;
    await writeState("ai-usage", { ...cur, [day]: (cur[day] ?? 0) + 1 });
  } catch { /* usage tracking must never block an answer */ }
}

export async function GET() {
  const u = await requireUser(); if (isResponse(u)) return u;
  let usage: Record<string, number> = {};
  try { usage = ((await readState("ai-usage"))?.data ?? {}) as Record<string, number>; } catch { /* unavailable */ }
  return NextResponse.json({ configured: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-2.5-flash", usage });
}

export async function POST(req: NextRequest) {
  const u = await requireUser(); if (isResponse(u)) return u;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  const b = (await req.json().catch(() => null)) as { task?: string; question?: string; context?: unknown; consent?: boolean } | null;
  if (!b?.task || !TASKS[b.task]) return NextResponse.json({ error: "bad_task" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  const context = redact(JSON.stringify(b.context ?? {}), { emails: b.task !== "email-actions" }).slice(0, 24_000);
  const prompt = `${TASKS[b.task]}\n${b.question ? `\nUser question: ${redact(String(b.question)).slice(0, 500)}\n` : ""}\nContext:\n${context}`;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction: SYSTEM, temperature: 0.3, ...(b.task === "email-actions" ? { responseMimeType: "application/json" } : {}) },
    });
    await bumpUsage();
    return NextResponse.json({ text: res.text ?? "" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    return NextResponse.json({ error: "ai_error" }, { status: 502 });
  }
}
