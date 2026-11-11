import test from "node:test";
import assert from "node:assert/strict";
import { resolveApp, resolveSlug, slugOf, appHref, monogram } from "../src/cc/apps/adapter.ts";

const app = (o: Record<string, unknown> = {}) => ({ id: "x", name: "X App", description: "", category: "Tools", url: "https://x.vercel.app", path: "/p", framework: "Next.js", ...o });
const ctx = { originIsLocal: false };

test("native apps never embed", () => {
  const d = resolveApp(app({ id: "rm-studio", name: "RM Studio" }), undefined, ctx);
  assert.equal(d.launchMode, "native");
  assert.ok(d.nativeRoutes!.length > 3);
});
test("embeddable https app embeds", () => {
  assert.equal(resolveApp(app(), { status: "healthy", embeddable: true }, ctx).launchMode, "embedded");
});
test("unprobed app embeds optimistically", () => {
  assert.equal(resolveApp(app(), undefined, ctx).launchMode, "embedded");
});
test("frame-blocking app is integrated, with requirements, never external", () => {
  const d = resolveApp(app(), { status: "healthy", embeddable: false }, ctx);
  assert.equal(d.launchMode, "integrated");
  assert.equal(d.embeddingAllowed, false);
  assert.match(d.requirements.join(" "), /frame-ancestors/);
  assert.doesNotMatch(d.requirements.join(" "), /\*\s/);
});
test("no url: mobile vs web", () => {
  assert.match(resolveApp(app({ url: null, framework: "Flutter" }), undefined, ctx).reason, /device app/);
  assert.match(resolveApp(app({ url: null }), undefined, ctx).requirements[0], /Deploy/);
  assert.equal(resolveApp(app({ url: null, framework: null }), undefined, ctx).launchMode, "integrated");
});
test("localhost app needs local origin", () => {
  const a = app({ url: "http://localhost:3030", localOnly: true });
  assert.equal(resolveApp(a, undefined, ctx).launchMode, "integrated");
  assert.equal(resolveApp(a, { status: "healthy", embeddable: true }, { originIsLocal: true }).launchMode, "embedded");
  assert.match(resolveApp(a, { status: "offline" }, { originIsLocal: true }).reason, /Not running/);
});
test("offline deployment is integrated", () => {
  assert.equal(resolveApp(app(), { status: "offline" }, ctx).launchMode, "integrated");
});
test("slugs and aliases", () => {
  assert.equal(slugOf("Leave Tracker_2"), "leave-tracker-2");
  assert.equal(resolveSlug("notes", ["cardstock", "billvault"]), "cardstock");
  assert.equal(resolveSlug("billvault", ["cardstock", "billvault"]), "billvault");
  assert.equal(resolveSlug("nope", ["a"]), undefined);
  assert.equal(appHref("deskboard"), "/workspace/apps/deskboard");
  assert.equal(monogram("Leave Tracker"), "LT");
});
