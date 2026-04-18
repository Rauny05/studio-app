"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function usePushNotifications() {
  const { data: session } = useSession();

  useEffect(() => {
    // Only run inside Capacitor native app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).Capacitor || !session?.user?.email) return;

    async function init() {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        await PushNotifications.register();

        // Save FCM token to server so we can send pushes
        await PushNotifications.addListener("registration", async ({ value: token }) => {
          try {
            await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
          } catch (e) {
            console.error("[push] Token save failed:", e);
          }
        });

        // Tap on notification while app is open
        await PushNotifications.addListener("pushNotificationActionPerformed", () => {
          window.location.href = "/deliverables";
        });

      } catch (e) {
        console.error("[push] Init failed:", e);
      }
    }

    init();
  }, [session?.user?.email]);
}
