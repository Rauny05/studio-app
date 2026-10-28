import { test } from "node:test";
import assert from "node:assert/strict";
import { isStaleWrite } from "../src/lib/sync-version.ts";

test("no header keeps legacy last-write-wins", () => {
  assert.equal(isStaleWrite(null, "2026-01-01T00:00:00.000Z"), false);
});
test("matching base version is accepted", () => {
  assert.equal(isStaleWrite("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), false);
});
test("moved-on envelope is stale", () => {
  assert.equal(isStaleWrite("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"), true);
});
test("empty base is only valid when nothing is stored", () => {
  assert.equal(isStaleWrite("none", null), false);
  assert.equal(isStaleWrite("none", "2026-01-02T00:00:00.000Z"), true);
});
