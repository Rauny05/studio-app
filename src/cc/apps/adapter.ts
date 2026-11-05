// Application adapter: turns a registry record + live probe into an internal launch decision.
// Pure on purpose (unit-tested). The rule: an app NEVER resolves to "open the external site".
// Anything that cannot render inside the workspace resolves to `integrated` with an explicit status.

export type LaunchMode = "native" | "embedded" | "integrated";
export type AuthMode = "rm-session" | "own-login" | "none" | "unknown";
type Health = "healthy" | "degraded" | "offline" | "unknown" | "not_configured";

export interface AppInput {
  id: string; name: string; description: string; category: string; url: string | null;
  path: string | null; framework: string | null; healthUrl?: string | null; localOnly?: boolean;
}
export interface ProbeInput { status: Health; httpStatus?: number; embeddable?: boolean; reason?: string }
export interface Ctx { originIsLocal: boolean }

export interface ApplicationDefinition {
  id: string; slug: string; name: string; description: string; icon: string; category: string;
  deploymentUrl: string | null; launchMode: LaunchMode; embeddingAllowed: boolean | null;
  authenticationMode: AuthMode; healthCheckUrl: string | null; status: Health;
  /** Why this launch mode was chosen. Shown in the workspace when the app can't be embedded. */
  reason: string;
  /** Concrete work needed to reach a better launch mode. Empty when nothing is outstanding. */
  requirements: string[];
  nativeRoutes?: { label: string; href: string }[];
}

/** Apps whose functionality already lives inside Command Center / RM Studio. */
export const NATIVE: Record<string, { label: string; href: string }[]> = {
  "rm-studio": [
    { label: "Home", href: "/home" }, { label: "My Day", href: "/my-day" }, { label: "Tasks", href: "/tasks" },
    { label: "To Shoot", href: "/to-shoot" }, { label: "Inbox", href: "/inbox" }, { label: "Calendar", href: "/agenda" },
    { label: "Operations", href: "/operations" },
  ],
  "command-center": [
    { label: "Home", href: "/home" }, { label: "Tasks", href: "/tasks" }, { label: "To Shoot", href: "/to-shoot" },
  ],
};

/** Short URL aliases (kept stable even if registry ids differ). */
export const ALIASES: Record<string, string> = { notes: "cardstock", "notes-app": "cardstock", expenses: "expense-tracker" };

/** Auth facts verified by probing the live deployment (redirect target) — everything else stays "unknown". */
const AUTH: Record<string, AuthMode> = { "rm-studio": "rm-session", "leave-tracker": "own-login", billvault: "own-login", swiftdrop: "none" };

export const slugOf = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const resolveSlug = (slug: string, ids: string[]) => {
  const s = ALIASES[slug] ?? slug;
  return ids.find((i) => slugOf(i) === s);
};
export const appHref = (id: string) => `/workspace/apps/${slugOf(id)}`;
export const monogram = (name: string) => name.replace(/\(.*?\)/g, "").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const isLocalUrl = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(u);

function noWebReason(framework: string | null): string {
  const f = (framework ?? "").toLowerCase();
  if (/android|kotlin|flutter|expo|react native|ios|swift/.test(f)) return `${framework} app. It is a device app with no web surface to render here.`;
  if (!f) return "Background service or CLI with no web interface.";
  return "No deployment URL is registered, so there is nothing to render yet.";
}

export function resolveApp(a: AppInput, probe: ProbeInput | undefined, ctx: Ctx): ApplicationDefinition {
  const base = {
    id: a.id, slug: slugOf(a.id), name: a.name, description: a.description, icon: monogram(a.name), category: a.category,
    deploymentUrl: a.url, authenticationMode: AUTH[a.id] ?? "unknown" as AuthMode, healthCheckUrl: a.healthUrl ?? a.url,
    status: (probe?.status ?? (a.url ? "unknown" : "not_configured")) as Health,
  };
  if (NATIVE[a.id]) return { ...base, launchMode: "native", embeddingAllowed: null, reason: "Runs natively inside Command Center.", requirements: [], nativeRoutes: NATIVE[a.id] };

  if (!a.url) {
    const web = !/android|kotlin|flutter|expo|react native|swift/i.test(a.framework ?? "") && !!a.framework;
    return { ...base, launchMode: "integrated", embeddingAllowed: null, reason: noWebReason(a.framework),
      requirements: web ? ["Deploy it (or run it) and add its URL in the app library — it will embed automatically if headers allow."]
        : ["Expose its data through an API, or rebuild the needed screens as a native RM Studio module."] };
  }

  if (isLocalUrl(a.url)) {
    if (!ctx.originIsLocal) return { ...base, launchMode: "integrated", embeddingAllowed: null,
      reason: "Runs on your Mac (localhost). A hosted RM Studio cannot reach it, and an https page cannot frame an http one.",
      requirements: ["Open RM Studio locally (npm run dev) while this tool is running, or deploy the tool to an https URL."] };
    if (probe && probe.status === "offline") return { ...base, launchMode: "integrated", embeddingAllowed: null,
      reason: `Not running. Start it${a.path ? ` from ${a.path}` : ""}, then refresh.`, requirements: ["Start the local dev server."] };
    return probe?.embeddable === false
      ? { ...base, launchMode: "integrated", embeddingAllowed: false, reason: "Sends a frame-blocking header (X-Frame-Options or CSP frame-ancestors).", requirements: ["Allow the RM Studio origin in frame-ancestors for this app."] }
      : { ...base, launchMode: "embedded", embeddingAllowed: probe?.embeddable ?? null, reason: "Local dev server, embedded while RM Studio also runs locally.", requirements: [] };
  }

  if (probe?.embeddable === false) return { ...base, launchMode: "integrated", embeddingAllowed: false,
    reason: "The app sends X-Frame-Options or a CSP frame-ancestors rule that stops other sites from framing it.",
    requirements: ["Add `Content-Security-Policy: frame-ancestors 'self' https://<rm-studio-origin>` (exact origin, no wildcard) and drop X-Frame-Options.", "Redeploy the app, then re-check."] };
  if (probe && probe.status === "offline") return { ...base, launchMode: "integrated", embeddingAllowed: probe.embeddable ?? null,
    reason: "The deployment is not responding from the server.", requirements: ["Check the deployment; the embed resumes automatically once it responds."] };
  return { ...base, launchMode: "embedded", embeddingAllowed: probe?.embeddable ?? null, reason: probe ? "Allows framing (no blocking headers seen)." : "Checking embed headers…", requirements: [] };
}
