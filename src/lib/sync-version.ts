/**
 * Optional optimistic-concurrency check for /api/sync/[key] writes.
 *
 * Clients that send `X-Base-Updated-At` (the `updatedAt` they last read) are
 * rejected with a conflict if the stored envelope has moved on. Clients that
 * omit the header (the existing web app) keep last-write-wins behaviour.
 */
export function isStaleWrite(
  baseUpdatedAt: string | null,
  currentUpdatedAt: string | null | undefined
): boolean {
  if (baseUpdatedAt === null) return false; // header not sent: legacy behaviour
  // "none" (or empty) means the client read a key with no stored value yet.
  const base = baseUpdatedAt === "none" ? "" : baseUpdatedAt;
  return base !== (currentUpdatedAt ?? "");
}
