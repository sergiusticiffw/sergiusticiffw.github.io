import Link from "next/link";

import { getPageFamilyAccess } from "@/lib/auth";
import { getDriveHealth } from "@/lib/google-drive";

export async function DriveReconnectBanner() {
  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return null;
  }

  const health = await getDriveHealth(family.familyId);
  if (health.status !== "expired") {
    return null;
  }

  const isAdmin = family.role === "admin";

  return (
    <div
      role="alert"
      className="border-b border-destructive/20 bg-destructive/10"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p>
          Accesul Google Drive a expirat. Reconectează-te ca să încarci sau
          deschizi fișiere.
        </p>
        {isAdmin ? (
          <Link
            href="/api/google/connect"
            className="shrink-0 font-medium underline-offset-4 hover:underline"
          >
            Reconectează Google Drive
          </Link>
        ) : (
          <Link
            href="/profile"
            className="shrink-0 font-medium underline-offset-4 hover:underline"
          >
            Vezi în Profil
          </Link>
        )}
      </div>
    </div>
  );
}
