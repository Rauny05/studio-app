import test from "node:test";
import assert from "node:assert/strict";
import { buildContext } from "../src/cc/lib/context.ts";

test("context only contains consented sections", () => {
  const c = buildContext({ today: "2026-10-30", tasks: [{ title: "x".repeat(300), status: "todo", priority: 1 }] });
  assert.ok("openTasks" in c);
  assert.ok(!("deliverables" in c));
  assert.ok(!("productionRecords" in c));
  assert.equal(c.openTasks![0].title!.length, 120);
});
