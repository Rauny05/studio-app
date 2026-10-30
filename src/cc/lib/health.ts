export type Health = "healthy" | "degraded" | "offline" | "unknown" | "not_configured";

export interface ProbeInput { url?: string | null; localOnly?: boolean }
export interface ProbeResult { status: Health; httpStatus?: number; ms?: number; embeddable?: boolean; reason?: string }

/** Map an HTTP outcome to a health state. 3xx/401/403 = reachable (login walls are alive). */
export function classifyHttp(httpStatus: number | null, error?: string): Health {
  if (httpStatus === null) return error ? "offline" : "unknown";
  if (httpStatus >= 500) return "degraded";
  if (httpStatus === 429 || httpStatus === 408) return "degraded";
  if (httpStatus >= 200 && httpStatus < 500) return "healthy";
  return "unknown";
}

/** Embeddable only if no XFO DENY/SAMEORIGIN and no restrictive frame-ancestors. */
export function embeddableFromHeaders(h: { xfo?: string | null; csp?: string | null }, parentOrigin?: string): boolean {
  const xfo = (h.xfo ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const m = (h.csp ?? "").toLowerCase().match(/frame-ancestors([^;]*)/);
  if (m) {
    const v = m[1].trim();
    if (v === "'none'" || v === "'self'") return false;
    if (parentOrigin && !v.split(/\s+/).some((x) => x === "*" || x === parentOrigin)) return false;
  }
  return true;
}

export function needsAttention(s: Health | undefined): boolean {
  return s === "degraded" || s === "offline";
}
