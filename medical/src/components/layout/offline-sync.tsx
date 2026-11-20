"use client";

import { useEffect } from "react";

import { syncOfflineCopy } from "@/lib/offline/sync";

/** Mounted once in the signed-in shell. Renders nothing. */
export function OfflineSync({ userId }: { userId: string }) {
  useEffect(() => {
    void syncOfflineCopy(userId).catch(() => undefined);
  }, [userId]);
  return null;
}
