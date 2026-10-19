import { Suspense } from "react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/profiles" className="text-base font-semibold">
              Dosar medical
            </Link>
            <Link href="/assistant" className="text-sm text-muted-foreground">
              Asistent
            </Link>
            <Link href="/family" className="text-sm text-muted-foreground">
              Familie
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Suspense
              fallback={
                <span className="text-sm text-muted-foreground">Se încarcă…</span>
              }
            >
              <CurrentUserEmail />
            </Suspense>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
}

async function CurrentUserEmail() {
  const user = await getCurrentUser();
  return (
    <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">
      {user.email}
    </span>
  );
}
