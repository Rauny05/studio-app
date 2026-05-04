// RM Studio Service Worker v2
// Strategy: cache-first for static assets, network-first for pages, offline fallback

const CACHE_VERSION = "v2";
const STATIC_CACHE  = `rm-static-${CACHE_VERSION}`;
const PAGE_CACHE    = `rm-pages-${CACHE_VERSION}`;
const IMAGE_CACHE   = `rm-images-${CACHE_VERSION}`;

const PRECACHE_PAGES = [
  "/",
  "/dashboard",
  "/projects",
  "/deliverables",
  "/calendar",
  "/settings",
  "/offline.html",
];

// ── Install — precache shell pages ───────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      // Precache pages best-effort (don't fail install if one 404s)
      await Promise.allSettled(PRECACHE_PAGES.map((url) => cache.add(url)));
    })()
  );
  self.skipWaiting();
});

// ── Activate — purge old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin, extension, and chrome-specific URLs
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // Always network for API

  // Static assets: cache-first, long TTL
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image/") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first, offline fallback
  if (req.mode === "navigate") {
    event.respondWith(networkFirstWithOffline(req));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(req, PAGE_CACHE));
});

// ── Strategy helpers ──────────────────────────────────────────────────────────
async function cacheFirst(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response("Asset unavailable offline", { status: 503 });
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached ?? new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithOffline(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;

    // Try matching the root path cached page
    const root = await cache.match("/");
    if (root) return root;

    // Last resort: offline page
    const offline = await cache.match("/offline.html");
    return offline ?? new Response("<h1>Offline</h1>", {
      headers: { "Content-Type": "text/html" },
      status: 503,
    });
  }
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const defaults = {
    title: "RM Studio",
    body: "You have a new update",
    icon: "/icon-192.png",
    badge: "/icon-maskable-192.png",
    url: "/dashboard",
    tag: "rm-studio",
  };

  let data = { ...defaults };
  try {
    if (event.data) data = { ...defaults, ...event.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [100, 50, 100, 50, 100],
    requireInteraction: false,
    tag: data.tag,
    renotify: true,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(target);
        } else {
          self.clients.openWindow(target);
        }
      })
  );
});

// ── Background sync (for future use) ─────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window" })
        .then((clients) => clients.forEach((c) => c.postMessage({ type: "SYNC_REQUESTED" })))
    );
  }
});
