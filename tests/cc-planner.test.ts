import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays, addMonths, bucketOf, completeTask, dateInTZ, diffDays, newTask, nextOccurrence,
  parseNaturalDate, parseQuickCapture, plannedLoad, reschedule, startOfWeek, timeInTZ,
} from "../src/cc/lib/planner.ts";

const TODAY = "2026-10-30"; // Friday

test("date arithmetic and month clamping", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(diffDays("2026-11-02", "2026-10-30"), 3);
  assert.equal(startOfWeek(TODAY), "2026-10-26");
});

test("studio timezone is Asia/Kolkata, not UTC", () => {
  const d = new Date("2026-10-29T20:00:00Z"); // 01:30 IST next day
  assert.equal(dateInTZ(d), "2026-10-30");
  assert.equal(timeInTZ(d), "01:30");
});

test("natural dates", () => {
  assert.equal(parseNaturalDate("call brand tomorrow", TODAY).date, "2026-10-31");
  assert.equal(parseNaturalDate("edit monday", TODAY).date, "2026-11-02");
  assert.equal(parseNaturalDate("edit friday", TODAY).date, "2026-11-06");
  assert.equal(parseNaturalDate("in 2 weeks", TODAY).date, "2026-11-13");
  assert.equal(parseNaturalDate("ship 5 nov", TODAY).date, "2026-11-05");
  assert.equal(parseNaturalDate("ship 5 jan", TODAY).date, "2027-01-05");
  const t = parseNaturalDate("sync today 4:30pm", TODAY);
  assert.equal(t.time, "16:30");
  assert.equal(t.rest, "sync");
});

test("quick capture separates deadline from planned time", () => {
  const q = parseQuickCapture("Cut reel tomorrow 3pm 90m !high #poco @gizmo by 2026-11-05", TODAY);
  assert.equal(q.title, "Cut reel");
  assert.equal(q.plannedDate, "2026-10-31");
  assert.equal(q.plannedStart, "15:00");
  assert.equal(q.due, "2026-11-05");
  assert.equal(q.durationMin, 90);
  assert.equal(q.priority, 3);
  assert.deepEqual(q.tags, ["poco"]);
  assert.equal(q.project, "gizmo");
});

test("deadline without a work slot is valid", () => {
  const q = parseQuickCapture("Invoice client by friday", TODAY);
  assert.equal(q.title, "Invoice client");
  assert.equal(q.due, "2026-11-06");
  assert.equal(q.plannedDate, undefined);
});

test("buckets", () => {
  const mk = (p: object) => newTask({ title: "x", ...p });
  assert.equal(bucketOf(mk({ due: "2026-10-29" }), TODAY), "overdue");
  assert.equal(bucketOf(mk({ plannedDate: "2026-10-29" }), TODAY), "overdue");
  assert.equal(bucketOf(mk({ plannedDate: TODAY }), TODAY), "today");
  assert.equal(bucketOf(mk({ due: TODAY }), TODAY), "today");
  assert.equal(bucketOf(mk({ due: "2026-11-01" }), TODAY), "upcoming");
  assert.equal(bucketOf(mk({}), TODAY), "unscheduled");
  assert.equal(bucketOf(mk({ status: "done", due: "2020-01-01" }), TODAY), "done");
});

test("recurrence", () => {
  assert.equal(nextOccurrence("2026-10-30", "weekdays"), "2026-11-02"); // Fri -> Mon
  assert.equal(nextOccurrence("2026-10-30", "weekly"), "2026-11-06");
  assert.equal(nextOccurrence("2026-10-30", "none"), undefined);
});

test("completing a recurring task spawns the next anchored on planned date", () => {
  const t = newTask({ title: "Weekly review", recurrence: "weekly", plannedDate: "2026-10-23", due: "2026-10-24" });
  const { done, next } = completeTask(t, new Date("2026-10-30T10:00:00Z"));
  assert.equal(done.status, "done");
  assert.ok(done.completedAt);
  assert.ok(next);
  assert.notEqual(next.id, t.id);
  assert.equal(next.plannedDate, "2026-10-30");
  assert.equal(next.due, "2026-10-31");
  assert.equal(next.status, "todo");
  assert.equal(next.completedAt, undefined);
});

test("non-recurring completion has no next", () => {
  assert.equal(completeTask(newTask({ title: "x" })).next, undefined);
});

test("rescheduling is explicit and logged", () => {
  const t = newTask({ title: "x", plannedDate: "2026-10-29", plannedStart: "10:00" });
  const r = reschedule(t, TODAY);
  assert.equal(r.plannedDate, TODAY);
  assert.equal(r.history.at(-1)?.text, "Planned for 2026-10-30");
  assert.equal(reschedule(t, undefined).plannedStart, undefined);
});

test("planned load sums durations of open tasks only", () => {
  const a = newTask({ title: "a", plannedDate: TODAY, durationMin: 60 });
  const b = newTask({ title: "b", plannedDate: TODAY, durationMin: 30, status: "done" });
  assert.equal(plannedLoad([a, b], TODAY).scheduledMin, 60);
});
