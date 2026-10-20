"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function FormDialog({
  open,
  title,
  pending = false,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  pending?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    if (!pending) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-0 h-dvh max-h-dvh w-full max-w-none rounded-none border-0 bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 sm:m-auto sm:h-auto sm:max-h-[min(92dvh,44rem)] sm:w-[min(100%-2rem,32rem)] sm:rounded-xl sm:border sm:open:zoom-in-95"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          close();
        }
      }}
    >
      <div className="flex h-full max-h-dvh flex-col sm:max-h-[min(92dvh,44rem)]">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button
            type="button"
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={close}
          >
            Închide
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
