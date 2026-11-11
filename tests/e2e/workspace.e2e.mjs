// End-to-end checks for the unified workspace: every app opens inside RM Studio, never outside it.
//
//   CC_E2E_PROFILE=<signed-in Chromium profile dir> CC_E2E_CHROME=<chromium binary> npm run test:e2e
//
// The profile must already hold an RM Studio session (sign in once with a headed run of the same profile).
// Writes screenshots and a JSON report to CC_E2E_OUT (default ./e2e-results).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = process.env.CC_E2E_BASE ?? "http://localhost:3000";
const OUT = process.env.CC_E2E_OUT ?? "e2e-results";
const PROFILE = process.env.CC_E2E_PROFILE;
const CHROME = process.env.CC_E2E_CHROME;
if (!PROFILE || !CHROME) { console.error("Set CC_E2E_PROFILE and CC_E2E_CHROME"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const PORTFOLIO = /portfolio|batta|sakshi|singh/i;
const results = [];
let failed = 0;
const check = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log("✔", name, detail ? `— ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""); }
  catch (e) { failed++; results.push({ name, ok: false, error: String(e?.message ?? e) }); console.log("✘", name, "—", e?.message ?? e); }
};

const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: CHROME, headless: true, viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const popups = [];
ctx.on("page", (p) => popups.push(p.url()));
const page = ctx.pages()[0] ?? await ctx.newPage();
const frameErrors = [];
page.on("console", (m) => { if (/Refused to (display|frame)|frame-ancestors|X-Frame-Options/i.test(m.text())) frameErrors.push(m.text()); });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const settle = (ms = 2500) => page.waitForTimeout(ms);
const shellVisible = async () => assert.ok(await page.locator(".cc-sb").isVisible(), "RM Studio sidebar not visible");
const onOrigin = () => assert.equal(new URL(page.url()).origin, new URL(BASE).origin, `left RM Studio: ${page.url()}`);

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await settle(4000);
if (new URL(page.url()).pathname.startsWith("/auth")) { console.error("Profile is not signed in."); process.exit(2); }

const registry = await page.evaluate(async () => (await (await fetch("/api/cc/apps")).json()).apps);
const approved = registry.filter((a) => (a.kind ?? "app") === "app");

await check("Home renders inside the shell", async () => { await shellVisible(); await shot("home"); });

// ---- Library ----
await page.goto(`${BASE}/apps`, { waitUntil: "domcontentloaded" }); await settle(3000);
await check("Library shows only approved applications", async () => {
  const names = await page.locator(".cc-appcard b").allTextContents();
  assert.ok(names.length > 0, "no apps rendered");
  const unique = [...new Set(names)];
  const expected = approved.map((a) => a.name).sort();
  assert.deepEqual(unique.sort(), expected, "library does not match the approved registry");
  const bad = unique.filter((n) => PORTFOLIO.test(n));
  assert.equal(bad.length, 0, `portfolio sites listed: ${bad}`);
  await shot("library");
  return `${unique.length} apps`;
});
await check("Every library card links to an internal route", async () => {
  const hrefs = await page.locator(".cc-appcard-link").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const bad = hrefs.filter((h) => !h?.startsWith("/workspace/apps/"));
  assert.equal(bad.length, 0, `non-internal links: ${bad}`);
  const targets = await page.locator("a[target=_blank]").count();
  assert.equal(targets, 0, "library contains target=_blank links");
});

// ---- Each approved app, opened by clicking it in the library ----
const appReport = [];
for (const a of approved) {
  await page.goto(`${BASE}/apps`, { waitUntil: "domcontentloaded" }); await settle(1500);
  const before = popups.length;
  await check(`${a.name}: opens inside RM Studio`, async () => {
    await page.locator(`.cc-appcard-link[aria-label="Open ${a.name}"]`).first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/workspace/apps/"), { timeout: 15000 });
    onOrigin(); await shellVisible();
    assert.equal(popups.length, before, "a new tab/window was opened");
    const frameEl = page.locator("iframe.cc-iframe");
    const r = { app: a.name, route: new URL(page.url()).pathname };
    if (await frameEl.count()) {
      await page.waitForSelector(".cc-frame-load", { state: "detached", timeout: 45000 }).catch(() => { throw new Error("perpetual loading state (45s)"); });
      const box = await frameEl.boundingBox();
      const area = await page.locator("main").boundingBox();
      assert.ok(box && area && Math.abs(box.width - area.width) < 2 && Math.abs(box.height - area.height) < 2, "iframe does not fill the workspace");
      const fr = page.frames().find((f) => f.url().startsWith(new URL(a.url).origin));
      assert.ok(fr, "app frame never navigated to the app");
      await fr.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(2500);
      const info = await fr.evaluate(() => {
        document.cookie = "cc_e2e_probe=1; SameSite=None; Secure; path=/";
        return { text: document.body?.innerText.trim().length ?? 0, title: document.title, login: !!document.querySelector('input[type="password"]'), cookie: document.cookie.includes("cc_e2e_probe=1"),
          nestedScroll: document.scrollingElement ? document.scrollingElement.scrollWidth > innerWidth + 1 : false };
      });
      assert.ok(info.text > 0, "app frame rendered no content");
      Object.assign(r, { mode: "embedded", title: info.title, signInShown: info.login, framedCookiesWork: info.cookie, horizontalOverflow: info.nestedScroll });
    } else {
      const txt = await page.locator("main").innerText();
      assert.match(txt, /Can’t render inside RM Studio yet|Not an application/, "neither an app frame nor an integration status");
      r.mode = "integration-status"; r.reason = txt.split("\n").find((l) => l.length > 40) ?? "";
    }
    appReport.push(r);
    if (["billvault", "deskboard", "cardstock"].includes(a.id)) await shot(`app-${a.id}`);
    return r.mode;
  });
}

// ---- Switching, history, refresh ----
await check("Switching apps keeps one document and the shell", async () => {
  await page.goto(`${BASE}/workspace/apps/billvault`, { waitUntil: "domcontentloaded" }); await settle(3000);
  await page.evaluate(() => { window.__ccMarker = 1; });
  await page.locator(".cc-sb a", { hasText: "All apps" }).click(); await settle(1500);
  await page.locator('.cc-appcard-link[aria-label="Open DeskBoard"]').click();
  await page.waitForURL(/\/workspace\/apps\/deskboard/); await settle(2000);
  assert.equal(await page.evaluate(() => window.__ccMarker), 1, "full page reload happened");
  onOrigin(); await shellVisible();
});
await check("Back and forward stay inside RM Studio", async () => {
  await page.goBack(); await settle(1500); assert.equal(new URL(page.url()).pathname, "/apps"); onOrigin();
  await page.goBack(); await settle(2500); assert.equal(new URL(page.url()).pathname, "/workspace/apps/billvault"); onOrigin();
  await page.goForward(); await settle(1500); assert.equal(new URL(page.url()).pathname, "/apps");
});
await check("Refresh preserves the internal app route", async () => {
  await page.goto(`${BASE}/workspace/apps/swiftdrop`, { waitUntil: "domcontentloaded" }); await settle(2000);
  await page.reload({ waitUntil: "domcontentloaded" }); await settle(4000);
  assert.equal(new URL(page.url()).pathname, "/workspace/apps/swiftdrop"); onOrigin(); await shellVisible();
  assert.ok(await page.locator("iframe.cc-iframe").count(), "app frame missing after refresh");
});
await check("The notes alias opens Cardstock", async () => {
  await page.goto(`${BASE}/workspace/apps/notes`, { waitUntil: "domcontentloaded" }); await settle(4000);
  const src = await page.locator("iframe.cc-iframe").getAttribute("src");
  assert.match(src ?? "", /cardstock-alpha/);
});
await check("Palette (⌘K) switches to an app internally", async () => {
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" }); await settle(3000);
  await page.keyboard.press("Meta+k"); await page.keyboard.type("billvault"); await settle(600); await page.keyboard.press("Enter");
  await page.waitForURL(/\/workspace\/apps\/billvault/, { timeout: 10000 }); onOrigin();
});

// ---- Studio modules (the original RM Studio pages) ----
for (const m of ["deliverables", "scripts", "settings"]) {
  await check(`Studio ${m} runs inside the shell`, async () => {
    await page.goto(`${BASE}/studio/${m}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".cc-frame-load", { state: "detached", timeout: 60000 });
    await shellVisible(); onOrigin();
    const fr = page.frames().find((f) => new URL(f.url()).pathname.startsWith(`/${m}`));
    assert.ok(fr, "module frame not found");
    await page.waitForTimeout(2500);
    const legacyChrome = await fr.evaluate(() => !!document.querySelector(".app-shell:not([data-embedded]) aside, .sidebar"));
    assert.equal(legacyChrome, false, "old sidebar rendered inside the frame (double shell)");
    if (m === "deliverables") await shot("studio-deliverables");
  });
}
await check("Opening an old page directly lands in the shell", async () => {
  await page.goto(`${BASE}/deliverables`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/studio\/deliverables/, { timeout: 30000 }); await shellVisible();
});

// ---- Daily pages ----
for (const [path, name] of [["/my-day", "my-day"], ["/to-shoot", "to-shoot"], ["/operations", "operations"], ["/home", "home-final"]]) {
  await check(`${path} renders`, async () => { await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await settle(3500); await shellVisible(); await shot(name); });
}

await check("No new tabs or windows were opened", async () => assert.deepEqual(popups, []));
await check("No frame-blocking console errors", async () => assert.deepEqual(frameErrors, []));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), failed, results, apps: appReport }, null, 2));
await ctx.close();
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
