import type { DeliverableItem, DeliverableRow } from "@/app/api/deliverables/route";

const ACTIVEPIECES_WEBHOOK_URL = "https://cloud.activepieces.com/api/v1/webhooks/HQ9CE9MLBf4l7ElvjHN7F";

function detectPlatform(text: string): string {
  if (/reel|instagram|\big\b|story|stories/i.test(text)) return "Instagram";
  if (/youtube|\byt\b|shorts?\b/i.test(text)) return "YouTube";
  if (/tiktok/i.test(text)) return "TikTok";
  if (/twitter|\bx\b/i.test(text)) return "X";
  if (/linkedin/i.test(text)) return "LinkedIn";
  return "Unknown";
}

/**
 * Fire-and-forget notification to the Activepieces automation webhook.
 * Never throws — a failure here must not block or roll back the deliverable
 * completion that already succeeded in Redis.
 */
export async function notifyDeliverableCompleted(row: DeliverableRow, item: DeliverableItem) {
  const payload = {
    deliverable_id: item.id ?? null,
    deliverable_name: item.label,
    campaign_name: row.pnNo,
    product_name: row.brand,
    platform: detectPlatform(`${item.label} ${item.type ?? ""}`),
    content_type: item.type ?? item.label,
    live_url: item.publishedUrl ?? null,
    completed_by: item.completedBy ?? null,
    completed_at: item.completedAt ?? null,
    poc: {
      name: row.pocName || null,
      company: row.pocCompany || null,
      contact: row.poc || null,
    },
  };

  try {
    const res = await fetch(ACTIVEPIECES_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[activepieces-webhook] Non-OK response ${res.status} for deliverable ${item.id ?? item.label}`);
    }
  } catch (err) {
    console.error(`[activepieces-webhook] Failed to notify for deliverable ${item.id ?? item.label}:`, err);
  }
}

/**
 * Compares the previous and new deliverable-overrides maps and notifies
 * Activepieces for every deliverable item that just transitioned to "Completed".
 */
export async function notifyNewlyCompletedDeliverables(
  previousOverrides: Record<string, DeliverableRow>,
  newOverrides: Record<string, DeliverableRow>
) {
  const notifications: Promise<void>[] = [];

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
        notifications.push(notifyDeliverableCompleted(row, item));
      }
    }
  }

  await Promise.allSettled(notifications);
}
