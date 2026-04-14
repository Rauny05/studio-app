import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), ".vault-config.json");

export function getVaultPath(): string | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.vaultPath === "string" ? parsed.vaultPath : null;
  } catch {
    return null;
  }
}

export function setVaultPath(vaultPath: string): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ vaultPath }, null, 2), "utf8");
}

export function clearVaultPath(): void {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
  } catch {
    // ignore
  }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function getProjectsDir(): string | null {
  const vaultPath = getVaultPath();
  if (!vaultPath) return null;
  return path.join(vaultPath, "ContentApp", "Projects");
}

export function getBoardDir(boardTitle: string): string | null {
  const projectsDir = getProjectsDir();
  if (!projectsDir) return null;
  return path.join(projectsDir, slugify(boardTitle));
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
