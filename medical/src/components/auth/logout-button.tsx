"use client";

import { useState } from "react";

import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { clearAssistantDeviceData } from "@/lib/assistant/chat-session";
import { clearUnlockOnLogout } from "@/lib/biometric-lock";
import { clearOfflineOnLogout } from "@/lib/offline/vault";

export function LogoutButton({
  userId,
  className,
}: {
  userId?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-9 px-3 sm:h-11 sm:px-4"}
      loading={pending}
      onClick={() => {
        setPending(true);
        clearAssistantDeviceData(userId);
        if (userId) {
          clearUnlockOnLogout(userId);
        }
        // Remove the encrypted offline copy before the session ends.
        void clearOfflineOnLogout(userId)
          .catch(() => undefined)
          .finally(() => {
            void logout();
          });
      }}
    >
      {pending ? "Se iese…" : "Ieșire"}
    </Button>
  );
}
