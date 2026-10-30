import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isResponse, requireUser } from "@/cc/server/auth";

/** Seed registry (from ~/Downloads/ClaudeHQ/agent/registry.json). User additions live in the `apps` state overlay. */
export async function GET() {
  const u = await requireUser(); if (isResponse(u)) return u;
  const raw = await fs.readFile(path.join(process.cwd(), "data", "app-registry.json"), "utf8");
  return NextResponse.json({ apps: JSON.parse(raw) });
}
