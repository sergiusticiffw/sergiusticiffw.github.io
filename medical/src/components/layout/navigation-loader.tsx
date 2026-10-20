"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/layout/spinner";

export function NavigationLoader() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = window.setTimeout(() => setPending(false), 12000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      setPending(true);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!pending) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      role="status"
      aria-live="polite"
      aria-label="Se încarcă pagina"
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-primary/20">
        <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background/55 backdrop-blur-[1px]">
        <Spinner />
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      </div>
    </div>
  );
}
