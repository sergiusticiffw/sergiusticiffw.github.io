import { Suspense } from "react";
import Link from "next/link";

import { getPageUser } from "@/lib/auth";
import { AppNav } from "@/components/layout/app-nav";
import { DriveReconnectBanner } from "@/components/layout/drive-reconnect-banner";
import { NavigationLoader } from "@/components/layout/navigation-loader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
          <Link href="/profiles" prefetch className="truncate text-base font-semibold">
            Dosar medical
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Suspense
              fallback={
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  Se încarcă…
                </span>
              }
            >
              <CurrentUserEmail />
            </Suspense>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <DriveReconnectBanner />
      </Suspense>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 pb-24 sm:py-6 sm:pb-24">
        {children}
      </main>
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      <Suspense
        fallback={
          <nav
            className="fixed inset-x-0 bottom-0 z-40 h-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] border-t bg-card/95"
            aria-hidden
          />
        }
      >
        <AppNav />
      </Suspense>
    </div>
  );
}

async function CurrentUserEmail() {
  const user = await getPageUser();
  return (
    <Link
      href="/profile"
      prefetch
      className="hidden max-w-48 truncate text-sm text-muted-foreground hover:text-foreground sm:inline"
    >
      {user.email}
    </Link>
  );
}
