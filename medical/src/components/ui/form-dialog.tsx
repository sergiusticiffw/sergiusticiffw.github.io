"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function FormDialog({
  open,
  title,
  pending = false,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  pending?: boolean;
  onClose: () => void;
  /** Sticky bottom actions (Renunță / Salvează), same pattern as edit record. */
  footer?: ReactNode;
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
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0"
            disabled={pending}
            onClick={close}
          >
            Închide
          </Button>
        </div>
        <div
          className={
            footer
              ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
              : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          }
        >
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
