"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

function SplashScreen() {
  useEffect(() => {
    // Dismiss splash after app is interactive (or 1.8s max)
    const dismiss = () => {
      const el = document.getElementById("pwa-splash");
      if (el) el.classList.add("splash-hidden");
    };

    // Wait for fonts + first paint, then fade out
    const timer = setTimeout(dismiss, 1200);

    // Also dismiss immediately if already rendered (revisit)
    if (document.readyState === "complete") {
      clearTimeout(timer);
      setTimeout(dismiss, 600);
    }

    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="pwa-splash" aria-hidden="true">
      <div className="splash-logo">
        <span>RM</span>
      </div>
      <div className="splash-name">RM Studio</div>
      <div className="splash-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SplashScreen />
      {children}
    </SessionProvider>
  );
}
