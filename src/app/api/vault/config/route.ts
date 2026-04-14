import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getVaultPath, setVaultPath, clearVaultPath, ensureDir, getProjectsDir } from "@/lib/vault-service";
import { stopWatcher, ensureWatcher } from "@/lib/vault-watcher";

export async function GET() {
  return NextResponse.json({ vaultPath: getVaultPath() });
}

export async function POST(req: NextRequest) {
  const { vaultPath } = await req.json();
  if (!vaultPath || typeof vaultPath !== "string") {
    return NextResponse.json({ error: "vaultPath required" }, { status: 400 });
  }
  if (!fs.existsSync(vaultPath)) {
    return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
  }
  setVaultPath(vaultPath);
  const projectsDir = getProjectsDir()!;
  ensureDir(projectsDir);
  stopWatcher();
  await ensureWatcher();
  return NextResponse.json({ ok: true, vaultPath });
}

export async function DELETE() {
  clearVaultPath();
  stopWatcher();
  return NextResponse.json({ ok: true });
}
