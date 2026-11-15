"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (fast opening, and the last-seen grocery list works offline in the store).
 * On the sign-in pages it clears the saved pages instead, so the next person on this phone doesn't see them.
 */
export function ServiceWorker({ clear = false }: { clear?: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    if (clear) {
      navigator.serviceWorker.getRegistration().then((r) => r?.active?.postMessage("clear")).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [clear]);
  return null;
}
