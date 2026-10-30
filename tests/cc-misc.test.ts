import test from "node:test";
import assert from "node:assert/strict";
import { fuzzyFilter, fuzzyScore } from "../src/cc/lib/fuzzy.ts";
import { redact } from "../src/cc/lib/redact.ts";
import { classifyHttp, embeddableFromHeaders } from "../src/cc/lib/health.ts";
import { calendarEntries, moveShoot, newShoot, nextShoot, readiness } from "../src/cc/lib/shoots.ts";

test("fuzzy ranks prefix > substring > subsequence and rejects non-matches", () => {
  assert.ok(fuzzyScore("bill", "BillVault") > fuzzyScore("bill", "My Bill Tracker"));
  assert.ok(fuzzyScore("bv", "BillVault") > 0);
  assert.equal(fuzzyScore("zzz", "BillVault"), -1);
  assert.deepEqual(fuzzyFilter(["Leave Tracker", "BillVault", "DeskBoard"], "dsk", (x) => x), ["DeskBoard"]);
});

test("redaction removes secrets but keeps normal prose", () => {
  const r = redact("Pay to IFSC HDFC0001234, PAN ABCDE1234F, password: hunter2, key AIzaSyA1234567890abcdefgh");
  assert.ok(!r.includes("ABCDE1234F"));
  assert.ok(!r.includes("hunter2"));
  assert.ok(!r.includes("AIzaSy"));
  assert.ok(!r.includes("HDFC0001234"));
  assert.equal(redact("Shoot the Poco unboxing on Tuesday"), "Shoot the Poco unboxing on Tuesday");
  assert.equal(redact("mail a@b.co", { emails: true }), "mail [EMAIL]");
});

test("health classification", () => {
  assert.equal(classifyHttp(200), "healthy");
  assert.equal(classifyHttp(307), "healthy");
  assert.equal(classifyHttp(401), "healthy");
  assert.equal(classifyHttp(503), "degraded");
  assert.equal(classifyHttp(null, "ECONNREFUSED"), "offline");
  assert.equal(classifyHttp(null), "unknown");
});

test("embedding policy", () => {
  assert.equal(embeddableFromHeaders({ xfo: "DENY" }), false);
  assert.equal(embeddableFromHeaders({ xfo: "SAMEORIGIN" }), false);
  assert.equal(embeddableFromHeaders({ csp: "default-src 'self'; frame-ancestors 'none'" }), false);
  assert.equal(embeddableFromHeaders({ csp: "frame-ancestors https://a.com" }, "https://b.com"), false);
  assert.equal(embeddableFromHeaders({ csp: "frame-ancestors https://a.com" }, "https://a.com"), true);
  assert.equal(embeddableFromHeaders({}), true);
});

test("shoot readiness lists real blockers", () => {
  const s = newShoot({ title: "Poco unboxing" }, new Date("2026-10-30T00:00:00Z"));
  const r = readiness(s);
  assert.equal(r.ready, false);
  assert.ok(r.missing.includes("shoot date"));
  assert.ok(r.missing.includes("brief or script"));
  const done = { ...s, brief: "b", shootDate: "2026-11-02", location: "Studio", checklist: s.checklist.map((c) => ({ ...c, done: true })) };
  assert.equal(readiness(done).ready, true);
});

test("status moves are logged; next shoot skips shot items", () => {
  const a = newShoot({ title: "a", shootDate: "2026-11-02", status: "Scheduled" });
  const b = newShoot({ title: "b", shootDate: "2026-11-01", status: "Shot" });
  assert.equal(nextShoot([a, b], "2026-10-30")?.title, "a");
  assert.equal(moveShoot(a, "Shot").history.at(-1)?.text, "Scheduled → Shot");
  assert.equal(calendarEntries([{ ...a, publishDeadline: "2026-11-10" }]).length, 2);
});
