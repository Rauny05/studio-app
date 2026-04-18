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
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Redis env vars not set");

  const res = await fetch(`${url}/get/${REDIS_KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[users-store] Redis GET failed ${res.status}: ${text}`);
    throw new Error(`Redis GET failed: ${res.status}`);
  }

  const json = await res.json() as { result: string | AllowedUser[] | null };
  if (!json.result) return [];

  // Unwrap however many encoding layers Upstash added
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = json.result;
  while (typeof value === "string") {
    try { value = JSON.parse(value); } catch { break; }
  }
  return Array.isArray(value) ? value as AllowedUser[] : [];
}

async function redisSet(users: AllowedUser[]): Promise<void> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Redis env vars not set");

  // Single-stringify: send the array as JSON body; Upstash serialises it as a string
  const res = await fetch(`${url}/set/${REDIS_KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(users),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[users-store] Redis SET failed ${res.status}: ${text}`);
    throw new Error(`Redis SET failed: ${res.status}`);
  }
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
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    writeFileSync(join(dataDir, "allowed-users.json"), JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("[users-store] File write failed:", err);
    throw err;
  }
}

export async function loadUsers(): Promise<AllowedUser[]> {
  if (redisUrl()) {
    try {
      return await redisGet();
    } catch (err) {
      console.error("[users-store] Redis load failed, falling back to file:", err);
      return fileGet();
    }
  }
  return fileGet();
}

export async function saveUsers(users: AllowedUser[]): Promise<void> {
  if (redisUrl()) {
    await redisSet(users); // throws on failure — let caller handle it
    return;
  }
  fileSet(users);
}
