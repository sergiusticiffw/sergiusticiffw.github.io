"use client";

import { useState } from "react";

import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { clearChatSession } from "@/lib/assistant/chat-session";
import { clearUnlockOnLogout } from "@/lib/biometric-lock";

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
      disabled={pending}
      onClick={() => {
        setPending(true);
        clearChatSession();
        if (userId) {
          clearUnlockOnLogout(userId);
        }
        void logout();
      }}
    >
      {pending ? "Se iese…" : "Ieșire"}
    </Button>
  );
}
