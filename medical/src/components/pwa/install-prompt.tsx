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

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key);
        }
      });
      return;
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
