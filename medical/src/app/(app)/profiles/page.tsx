import { Suspense } from "react";

import { PageFallback } from "@/components/layout/page-fallback";
import { AddProfileButton } from "@/components/profiles/profile-form";
import { ProfileList } from "@/components/profiles/profile-list";
import { getPageFamilyAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = {
  title: "Profiluri",
};

export const maxDuration = 60;

export default function ProfilesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profiluri</h1>
        <p className="text-sm text-muted-foreground">
          Alege o persoană. Documentele se încarcă din pagina ei.
        </p>
      </div>
      <Suspense fallback={<PageFallback label="Se încarcă profilurile…" />}>
        <ProfilesSection />
      </Suspense>
    </div>
  );
}

async function ProfilesSection() {
  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [profilesResult, connectionResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, birth_date, idnp")
      .eq("family_id", family.familyId)
      .order("display_name", { ascending: true }),
    supabase
      .from("google_drive_connections")
      .select("family_id")
      .eq("family_id", family.familyId)
      .maybeSingle(),
  ]);

  const listError = profilesResult.error;
  if (listError) {
    console.error("listProfiles", listError.code);
    if (listError.code === "42703" || listError.code === "PGRST204") {
      return (
        <p role="alert" className="text-sm text-destructive">
          Aplică migrația pentru IDNP înainte să încarci profilurile.
        </p>
      );
    }
    return (
      <p role="alert" className="text-sm text-destructive">
        Profilurile nu au putut fi încărcate.
      </p>
    );
  }

  const profiles = ((profilesResult.data ?? []) as {
    id: string;
    display_name: string;
    birth_date: string | null;
    idnp: string | null;
  }[]).map((profile) => ({ ...profile, notes: null }));
  return (
    <div className="flex flex-col gap-6">
      {family.role === "admin" ? (
        <p className="text-sm text-muted-foreground">
          Google Drive se conectează din{" "}
          <Link href="/profile" className="underline-offset-4 hover:underline">
            Profil
          </Link>
          .
        </p>
      ) : null}
      {family.role === "admin" ? (
        <AddProfileButton driveConnected={Boolean(connectionResult.data)} />
      ) : null}
      <ProfileList profiles={profiles} />
    </div>
  );
}
