"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/profiles",
    label: "Profiluri",
    match: (path: string) => path === "/profiles" || path.startsWith("/profiles/"),
  },
  {
    href: "/records",
    label: "Dosar",
    match: (path: string) => path.startsWith("/records"),
  },
  {
    href: "/assistant",
    label: "Asistent",
    match: (path: string) => path.startsWith("/assistant"),
  },
  {
    href: "/family",
    label: "Familie",
    match: (path: string) => path.startsWith("/family"),
  },
  {
    href: "/profile",
    label: "Profil",
    match: (path: string) => path === "/profile" || path.startsWith("/profile/"),
  },
] as const;

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c.6-2.6 2.9-4.5 6-4.5s5.4 1.9 6 4.5" />
      <path d="M14.5 14.6c1.7-.7 3.7-.6 5.5.6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.2-3 3.7-5 7-5s5.8 2 7 5" />
    </svg>
  );
}

const icons = {
  "/profiles": FolderIcon,
  "/records": ListIcon,
  "/assistant": ChatIcon,
  "/family": PeopleIcon,
  "/profile": UserIcon,
} as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
      aria-label="Pagini"
    >
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {links.map((link) => {
          const active = link.match(pathname);
          const Icon = icons[link.href];
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium"
                    : "flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-xs text-muted-foreground"
                }
              >
                <Icon />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
