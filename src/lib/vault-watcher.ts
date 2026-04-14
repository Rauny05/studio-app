import path from "path";
import { getVaultPath } from "./vault-service";

type WatchEvent = { type: "add" | "change" | "unlink"; filePath: string };
type Listener = (event: WatchEvent) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let watcher: any = null;
const listeners = new Set<Listener>();

export async function ensureWatcher() {
  const vaultPath = getVaultPath();
  if (!vaultPath || watcher) return;
  const chokidar = await import("chokidar");
  const watchPath = path.join(vaultPath, "ContentApp");
  watcher = chokidar.watch(watchPath, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../,
    persistent: true,
  });
  watcher.on("add", (p: string) => broadcast({ type: "add", filePath: p }));
  watcher.on("change", (p: string) => broadcast({ type: "change", filePath: p }));
  watcher.on("unlink", (p: string) => broadcast({ type: "unlink", filePath: p }));
}

export function stopWatcher() {
  watcher?.close();
  watcher = null;
}

export function addWatchListener(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function broadcast(event: WatchEvent) {
  listeners.forEach((fn) => fn(event));
}
