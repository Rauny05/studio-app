"use client";

import { useEffect, useState } from "react";

type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export function usePush() {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    async function init() {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        const perm = Notification.permission;
        if (perm === "denied") { setState("denied"); return; }

        const existing = await reg.pushManager.getSubscription();
        setState(existing ? "subscribed" : "unsubscribed");
      } catch {
        setState("unsupported");
      }
    }

    init();
  }, []);

  async function subscribe(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return false; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setState("subscribed");
      return true;
    } catch {
      setState("unsubscribed");
      return false;
    }
  }

  async function unsubscribe(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setState("unsubscribed"); return; }

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      setState("unsubscribed");
    } catch {}
  }

  return { state, subscribe, unsubscribe };
}

