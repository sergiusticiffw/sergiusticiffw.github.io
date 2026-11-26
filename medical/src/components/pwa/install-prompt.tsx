"use client";

import { useEffect } from "react";

function registerProductionWorker() {
  void navigator.serviceWorker.register("/sw.js", {
    updateViaCache: "none",
  });
}

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Keep SW registered for PWA offline shell. In development we still clear
    // old caches so stale shells do not stick around.
    if (process.env.NODE_ENV === "development") {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key);
        }
      });
    }

    // Defer so the first paint / hydration is not racing the SW on iOS.
    function scheduleRegister() {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => registerProductionWorker(), {
          timeout: 3_000,
        });
        return;
      }
      window.setTimeout(registerProductionWorker, 1_500);
    }

    if (document.readyState === "complete") {
      scheduleRegister();
      return;
    }

    window.addEventListener("load", scheduleRegister, { once: true });
    return () => {
      window.removeEventListener("load", scheduleRegister);
    };
  }, []);

  return null;
}
