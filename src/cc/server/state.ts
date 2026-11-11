import { promises as fs } from "fs";
import path from "path";
import { dataGet, dataSet } from "@/lib/data-store";

export interface Envelope<T = unknown> { data: T; updatedAt: string }
export const STATE_KEYS = ["tasks", "shoots", "prefs", "apps", "ai-usage"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export class NotConfigured extends Error {}

const hasRedis = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const devDir = path.join(process.cwd(), ".cc-data");

/** Redis in production; dev-only JSON file when Redis is not configured. Never silently fakes persistence. */
export async function readState(key: StateKey): Promise<Envelope | null> {
  if (hasRedis()) return dataGet<Envelope>(`cc:state:${key}`);
  if (process.env.NODE_ENV === "production") throw new NotConfigured("Redis not configured");
  try { return JSON.parse(await fs.readFile(path.join(devDir, `${key}.json`), "utf8")) as Envelope; }
  catch { return null; }
}

export async function writeState(key: StateKey, data: unknown): Promise<Envelope> {
  const env: Envelope = { data, updatedAt: new Date().toISOString() };
  if (hasRedis()) { await dataSet(`cc:state:${key}`, env); return env; }
  if (process.env.NODE_ENV === "production") throw new NotConfigured("Redis not configured");
  await fs.mkdir(devDir, { recursive: true });
  await fs.writeFile(path.join(devDir, `${key}.json`), JSON.stringify(env));
  return env;
}
