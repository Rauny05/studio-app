/**
 * Generic Redis get/set for cloud sync.
 * Follows the exact same pattern as users-store.ts.
 * Keys: studio:sync:kanban | studio:sync:todos | studio:sync:reels
 */

function redisUrl() { return process.env.UPSTASH_REDIS_REST_URL; }
function redisToken() { return process.env.UPSTASH_REDIS_REST_TOKEN; }

export async function dataGet<T>(key: string): Promise<T | null> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Redis env vars not set");

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[data-store] Redis GET failed ${res.status}: ${text}`);
    throw new Error(`Redis GET failed: ${res.status}`);
  }

  const json = await res.json() as { result: string | T | null };
  if (json.result === null || json.result === undefined) return null;

  // Upstash may return the stored JSON as a string or already-parsed value
  if (typeof json.result === "string") {
    try {
      return JSON.parse(json.result) as T;
    } catch {
      return null;
    }
  }
  return json.result as T;
}

export async function dataSet<T>(key: string, value: T): Promise<void> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error("Redis env vars not set");

  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[data-store] Redis SET failed ${res.status}: ${text}`);
    throw new Error(`Redis SET failed: ${res.status}`);
  }
}
