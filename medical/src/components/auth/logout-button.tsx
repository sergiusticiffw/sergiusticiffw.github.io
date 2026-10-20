"use client";

import { useState } from "react";

import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-9 px-3 sm:h-11 sm:px-4"}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void logout();
      }}
    >
      {pending ? "Se iese…" : "Ieșire"}
    </Button>
  );
}
