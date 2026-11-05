/** Builds the minimal, explicit context sent to Gemini. Only fields the user consented to; free text is truncated. */
export interface CtxTask { title: string; status: string; priority: number; due?: string; plannedDate?: string; plannedStart?: string; project?: string }
export interface CtxShoot { title: string; status: string; client?: string; shootDate?: string; publishDeadline?: string; location?: string }
export interface CtxDeliverable { pnNo: string; brand: string; overallStatus: string; goLiveDate?: string; advance50: boolean; payment100: boolean; items: number; itemsDone: number }

export function buildContext(input: { today: string; tasks?: CtxTask[]; shoots?: CtxShoot[]; deliverables?: CtxDeliverable[] }) {
  const cut = (s?: string) => s?.slice(0, 120);
  return {
    today: input.today, timezone: "Asia/Kolkata",
    ...(input.tasks ? { openTasks: input.tasks.slice(0, 80).map((t) => ({ ...t, title: cut(t.title), project: cut(t.project) })) } : {}),
    ...(input.shoots ? { productionRecords: input.shoots.slice(0, 60).map((s) => ({ ...s, title: cut(s.title) })) } : {}),
    ...(input.deliverables ? { deliverables: input.deliverables.slice(0, 80) } : {}),
  };
}
