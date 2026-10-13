import type { DeliverableItem, DeliverableRow } from "@/app/api/deliverables/route";

export interface CompletedDeliverable {
  row: DeliverableRow;
  item: DeliverableItem;
}

/**
 * Compares the previous and new deliverable-overrides maps and returns every
 * deliverable item that just transitioned to "Completed" in this write.
 * Shared by every side-effect that should fire on completion (Activepieces
 * webhook, Sheet write-back) so they agree on exactly what counts as "new".
 */
export function findNewlyCompleted(
  previousOverrides: Record<string, DeliverableRow>,
  newOverrides: Record<string, DeliverableRow>
): CompletedDeliverable[] {
  const found: CompletedDeliverable[] = [];

  for (const row of Object.values(newOverrides)) {
    if (!row?.deliverables) continue;
    const prevRow = previousOverrides[row.id];

    for (const item of row.deliverables) {
      if (item.status !== "Completed") continue;

      const prevItem = item.id
        ? prevRow?.deliverables.find((d) => d.id === item.id)
        : prevRow?.deliverables.find((d) => d.label === item.label);

      const wasAlreadyCompleted = prevItem?.status === "Completed";
      if (!wasAlreadyCompleted) {
        found.push({ row, item });
      }
    }
  }

  return found;
}
