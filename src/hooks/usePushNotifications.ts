"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function usePushNotifications() {
  const { data: session } = useSession();

  useEffect(() => {
    // Only run inside Capacitor native app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Capacitor = (window as any).Capacitor;
    if (!Capacitor || !session?.user?.email) return;

    async function init() {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Request permission
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        // Register with FCM
        await PushNotifications.register();

        // When we get the FCM token, save it to our server
        await PushNotifications.addListener("registration", async (token) => {
          try {
            await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: token.value }),
            });
          } catch (e) {
            console.error("[push] Token registration failed:", e);
          }
        });

        // Handle notification tapped while app is open
        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("[push] Received:", notification.title);
        });

        // Handle tap on notification (app in background/closed)
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
