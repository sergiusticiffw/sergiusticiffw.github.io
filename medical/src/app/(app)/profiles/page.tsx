import { Suspense } from "react";

import { PageFallback } from "@/components/layout/page-fallback";
import { AddProfileButton } from "@/components/profiles/profile-form";
import { ProfileList } from "@/components/profiles/profile-list";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPageFamilyAccess } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-oauth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = {
  title: "Profiluri",
};

export const maxDuration = 60;

export default function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profiluri</h1>
        <p className="text-sm text-muted-foreground">
          Alege o persoană. Documentele se încarcă din pagina ei.
        </p>
      </div>
      <Suspense fallback={<PageFallback label="Se încarcă profilurile…" />}>
        <ProfilesSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProfilesSection({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const driveStatus = (await searchParams).drive;
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
    family.role === "admin"
      ? supabase
          .from("google_drive_connections")
          .select("family_id")
          .eq("family_id", family.familyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const listError = profilesResult.error ?? connectionResult.error;
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
  const driveConnected = Boolean(connectionResult.data);
  const googleConfigured = Boolean(getGoogleConfig());

  return (
    <div className="flex flex-col gap-6">
      {family.role === "admin" ? (
        <DriveStatus
          status={driveStatus}
          configured={googleConfigured}
          connected={driveConnected}
        />
      ) : null}
      {family.role === "admin" ? <AddProfileButton /> : null}
      <ProfileList profiles={profiles} />
    </div>
  );
}

function DriveStatus({
  status,
  configured,
  connected,
}: {
  status?: string;
  configured: boolean;
  connected: boolean;
}) {
  const message =
    status === "connected"
      ? "Google Drive este conectat. Fișierele rămân private, fără link public."
      : status === "config"
        ? "Completează pe server clientul OAuth și cheia de criptare."
        : status === "error"
          ? "Conectarea cu Google Drive nu a reușit."
          : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Drive</CardTitle>
        <CardDescription>
          PDF-urile și fotografiile stau într-un folder privat din My Drive.
          Supabase păstrează doar datele și identificatorul fișierului.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {message ? (
          <p
            role={status === "connected" ? "status" : "alert"}
            className={
              status === "connected"
                ? "text-sm"
                : "text-sm text-destructive"
            }
          >
            {message}
          </p>
        ) : null}
        {connected ? (
          <p className="text-sm text-muted-foreground">
            Contul Google este conectat. Poți încărca documente din pagina
            unei persoane.
          </p>
        ) : configured ? (
          <Link
            href="/api/google/connect"
            className={cn(buttonVariants(), "h-11 w-fit")}
          >
            Conectează Google Drive
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configurarea Google lipsește pe server.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
