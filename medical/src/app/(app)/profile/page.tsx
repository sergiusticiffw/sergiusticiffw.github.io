import { Suspense } from "react";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { BiometricSettings } from "@/components/profile/biometric-settings";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DriveSettings } from "@/components/profile/drive-settings";
import { PageFallback } from "@/components/layout/page-fallback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { modelLabel } from "@/lib/assistant/models";
import { loadAiUsage } from "@/lib/assistant/usage";
import { getPageFamilyAccess, getPageUser, type FamilyRole } from "@/lib/auth";
import {
  formatDateTime,
  formatDurationUntil,
  formatNumber,
} from "@/lib/format";
import { getDriveConnectionMeta, getDriveHealth } from "@/lib/google-drive";
import { getGoogleConfig } from "@/lib/google-oauth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profil",
};

const roleLabels: Record<FamilyRole, string> = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Cititor",
};

export default function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-sm text-muted-foreground">
          Contul tău, Google Drive și utilizarea asistentului.
        </p>
      </div>
      <Suspense fallback={<PageFallback label="Se încarcă profilul…" />}>
        <ProfileSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProfileSection({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const driveStatus = (await searchParams).drive;
  const [user, family] = await Promise.all([getPageUser(), getPageFamilyAccess()]);
  if (!family.familyId || !family.role) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const geminiEnabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  const googleConfigured = Boolean(getGoogleConfig());

  const [
    familyResult,
    authResult,
    driveMeta,
    driveHealth,
    ai,
    profilesResult,
    membersResult,
  ] = await Promise.all([
    supabase.from("families").select("name").eq("id", family.familyId).maybeSingle(),
    supabase.auth.getUser(),
    getDriveConnectionMeta(family.familyId),
    getDriveHealth(family.familyId),
    loadAiUsage(family.familyId),
    supabase.from("profiles").select("id").eq("family_id", family.familyId),
    supabase
      .from("family_members")
      .select("user_id", { count: "exact", head: true })
      .eq("family_id", family.familyId),
  ]);

  if (familyResult.error) {
    console.error("profileFamily", familyResult.error.code);
  }
  if (profilesResult.error) {
    console.error("profilePeople", profilesResult.error.code);
  }

  const profileIds = ((profilesResult.data ?? []) as { id: string }[]).map(
    (row) => row.id,
  );
  const documentsResult =
    profileIds.length > 0
      ? await supabase
          .from("medical_documents")
          .select("id", { count: "exact", head: true })
          .in("profile_id", profileIds)
      : { count: 0, error: null };
  if (documentsResult.error) {
    console.error("profileDocuments", documentsResult.error.code);
  }

  const familyRow = familyResult.data as { name: string } | null;
  const authUser = authResult.data.user;
  const driveConnected = Boolean(
    "connected" in driveMeta ? driveMeta.connected : false,
  );
  const driveUpdatedAt =
    driveMeta && "updatedAt" in driveMeta ? (driveMeta.updatedAt ?? null) : null;
  const driveError = "error" in driveMeta ? driveMeta.error : null;

  const limitRows = ai.limits;
  const runtime = ai.runtime;
  const resetAt = ai.resetAt;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cont</CardTitle>
          <CardDescription>Datele cu care ești autentificat.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Email: </span>
            {user.email || "nesetat"}
          </p>
          <p>
            <span className="text-muted-foreground">Rol: </span>
            {roleLabels[family.role]}
          </p>
          <p>
            <span className="text-muted-foreground">Familie: </span>
            {familyRow?.name ?? "Familie"}
          </p>
          {authUser?.last_sign_in_at ? (
            <p>
              <span className="text-muted-foreground">Ultima autentificare: </span>
              {formatDateTime(authUser.last_sign_in_at)}
            </p>
          ) : null}
          {authUser?.created_at ? (
            <p>
              <span className="text-muted-foreground">Cont creat: </span>
              {formatDateTime(authUser.created_at)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Drive</CardTitle>
          <CardDescription>
            Alege sau reconectează contul Google folosit pentru fișiere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {driveError ? (
            <p role="alert" className="text-sm text-destructive">
              {driveError}
            </p>
          ) : (
            <DriveSettings
              status={driveStatus}
              configured={googleConfigured}
              connected={driveConnected}
              expired={driveHealth.status === "expired"}
              updatedAt={formatDateTime(driveUpdatedAt)}
              isAdmin={family.role === "admin"}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asistent AI</CardTitle>
          <CardDescription>
            Utilizarea de azi, după ora Pacific. Limita zilnică Gemini se
            resetează la miezul nopții acolo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <span className="text-muted-foreground">Cheie Gemini: </span>
            {geminiEnabled ? "configurată pe server" : "lipsă"}
          </p>
          <p>
            <span className="text-muted-foreground">Întrebări azi: </span>
            {formatNumber(ai.usage.questions)}
          </p>
          <p>
            <span className="text-muted-foreground">Cereri către Gemini: </span>
            {formatNumber(ai.usage.requests)}
          </p>
          <p>
            <span className="text-muted-foreground">Tokeni folosiți: </span>
            {formatNumber(ai.usage.tokens)}
          </p>
          <p>
            <span className="text-muted-foreground">Ultimul model: </span>
            {ai.usage.lastModel
              ? modelLabel(ai.usage.lastModel)
              : runtime.lastFailed
                ? modelLabel(runtime.lastFailed.model)
                : "încă nu a fost folosit azi"}
          </p>
          <p>
            <span className="text-muted-foreground">Resetare cotă zilnică: </span>
            {formatDateTime(resetAt)} ({formatDurationUntil(resetAt)})
          </p>
          {runtime.lastFailed ? (
            <p>
              <span className="text-muted-foreground">Următorul model încercat: </span>
              {modelLabel(runtime.lastFailed.model)} a eșuat; se sare peste el
              până la {formatDateTime(runtime.lastFailed.until)}.
            </p>
          ) : null}
          {limitRows.length > 0 ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="font-medium">Limite recente</p>
              {limitRows.map((limit) => (
                <p key={limit.model} className="text-muted-foreground">
                  {modelLabel(limit.model)}
                  {limit.daily ? " · limită zilnică" : " · limită pe minut"}
                  {limit.quotaLimit ? ` (${formatNumber(limit.quotaLimit)})` : ""}
                  {limit.until > Date.now()
                    ? ` · pauză până la ${formatDateTime(limit.until)}`
                    : ` · ultima dată ${formatDateTime(limit.at)}`}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Niciun model nu este în pauză acum.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dosar</CardTitle>
          <CardDescription>Câte date sunt în familia ta.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Persoane: </span>
            {formatNumber(profileIds.length)}
          </p>
          <p>
            <span className="text-muted-foreground">Documente: </span>
            {formatNumber(documentsResult.count ?? 0)}
          </p>
          <p>
            <span className="text-muted-foreground">Membri familie: </span>
            {formatNumber(membersResult.count ?? 0)}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/family" className="text-sm underline-offset-4 hover:underline">
              Gestionează familia
            </Link>
            <Link href="/profiles" className="text-sm underline-offset-4 hover:underline">
              Vezi profilurile
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Securitate pe acest dispozitiv</CardTitle>
          <CardDescription>
            Deblocare cu Face ID, amprentă sau Windows Hello după ce ești deja
            autentificat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BiometricSettings userId={user.id} email={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parolă</CardTitle>
          <CardDescription>Schimbă parola acestui cont.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <LogoutButton userId={user.id} className="h-11 w-full sm:w-fit" />
    </div>
  );
}
