import test from "node:test";
import assert from "node:assert/strict";
import { parseMonth } from "../src/lib/pn-month.ts";

test("full month prefixes are not cut to two letters", () => {
  assert.equal(parseMonth("may26-08"), "May 2026");
  assert.equal(parseMonth("jul26-15"), "Jul 2026");
  assert.equal(parseMonth("jun26-1"), "Jun 2026");
  assert.equal(parseMonth("mar26-3"), "Mar 2026");
});

test("short sheet prefixes still resolve", () => {
  assert.equal(parseMonth("ma26-21"), "Mar 2026");
  assert.equal(parseMonth("ju26-15-4/7"), "Jun 2026");
  assert.equal(parseMonth("ag25-2"), "Aug 2025");
  assert.equal(parseMonth("sp25-9"), "Sep 2025");
  assert.equal(parseMonth("oc26-1"), "Oct 2026");
  assert.equal(parseMonth("ap2025-4"), "Apr 2025");
});

test("no PN gives no month", () => {
  assert.equal(parseMonth(""), "");
  assert.equal(parseMonth("row-12"), "");
});
