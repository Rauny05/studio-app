/**
 * User store — reads/writes allowed-users list.
 * Uses Upstash Redis in production (UPSTASH_REDIS_REST_URL set),
 * falls back to local JSON file in development.
 */

export interface AllowedUser {
  email: string;
  name?: string;
  role: "admin" | "member";
  permissions: string[];
  addedAt: string;
}

const REDIS_KEY = "studio:allowed-users";

function redisUrl() { return process.env.UPSTASH_REDIS_REST_URL; }
function redisToken() { return process.env.UPSTASH_REDIS_REST_TOKEN; }

async function redisGet(): Promise<AllowedUser[]> {
  const res = await fetch(`${redisUrl()}/get/${REDIS_KEY}`, {
    headers: { Authorization: `Bearer ${redisToken()}` },
    cache: "no-store",
  });
  const json = await res.json() as { result: string | null };
  if (!json.result) return [];
  return JSON.parse(json.result) as AllowedUser[];
}

async function redisSet(users: AllowedUser[]): Promise<void> {
  await fetch(`${redisUrl()}/set/${REDIS_KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(users)),
  });
}

function fileGet(): AllowedUser[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    const p = join(process.cwd(), "data", "allowed-users.json");
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf-8")) as AllowedUser[];
  } catch { return []; }
}

function fileSet(users: AllowedUser[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeFileSync, mkdirSync, existsSync } = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require("path");
    const dataDir = join(process.cwd(), "data");
    // Create data directory if it doesn't exist
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    writeFileSync(join(dataDir, "allowed-users.json"), JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Failed to save users:", err);
  }
}

export async function loadUsers(): Promise<AllowedUser[]> {
  if (redisUrl()) return redisGet();
  return fileGet();
}

export async function saveUsers(users: AllowedUser[]): Promise<void> {
  if (redisUrl()) { await redisSet(users); return; }
  fileSet(users);
}
