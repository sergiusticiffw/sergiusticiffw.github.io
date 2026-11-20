"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";

export type SwitcherPerson = { id: string; display_name: string };

const PROFILE_PATH = /^\/profiles\/([0-9a-f-]{36})(?:\/|$)/i;

/**
 * Header chip that always names the person whose records are on screen and
 * opens a bottom sheet to switch to another family member.
 */
export function PersonSwitcher({ people }: { people: SwitcherPerson[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // The sheet is open only for the path it was opened on, so navigating to
  // another person closes it without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);

  const currentId = pathname.match(PROFILE_PATH)?.[1]?.toLowerCase() ?? null;
  const current = currentId
    ? people.find((person) => person.id.toLowerCase() === currentId)
    : undefined;

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

  if (!current) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Persoana curentă: ${current.display_name}. Schimbă persoana`}
        className="flex min-h-11 min-w-0 max-w-[60%] items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => setOpen(true)}
      >
        <Avatar name={current.display_name} size="sm" />
        <span className="truncate">{current.display_name}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-2xl border-0 bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 open:animate-in open:slide-in-from-bottom sm:m-auto sm:w-[min(100%-2rem,24rem)] sm:rounded-xl sm:border"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            setOpen(false);
          }
        }}
      >
        <div className="flex max-h-[80dvh] flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <h2 id={titleId} className="px-4 pt-4 pb-2 text-base font-semibold">
            Cu cine lucrezi?
          </h2>
          <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
            {people.map((person) => {
              const active = person.id === current.id;
              return (
                <li key={person.id}>
                  <Link
                    href={`/profiles/${person.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 items-center gap-3 rounded-lg px-2 text-base hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
                      active ? "bg-muted font-semibold" : ""
                    }`}
                    onClick={() => {
                      if (active) {
                        setOpen(false);
                      }
                    }}
                  >
                    <Avatar name={person.display_name} />
                    <span className="min-w-0 flex-1 truncate">
                      {person.display_name}
                    </span>
                    {active ? (
                      <span className="text-sm text-muted-foreground">
                        Selectat
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 px-4 pt-3">
            <Link
              href="/profiles"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Toate persoanele
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => setOpen(false)}
            >
              Închide
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
