import { Suspense } from "react";
import Link from "next/link";

import { PageFallback } from "@/components/layout/page-fallback";
import { ProfileDetail } from "@/components/profiles/profile-list";
import { canWrite, getFamilyAccess, requireProfileWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Persoană",
};

export const maxDuration = 60;

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/profiles" prefetch className="text-sm text-muted-foreground hover:underline">
        Toate persoanele
      </Link>
      <Suspense fallback={<PageFallback label="Se încarcă persoana…" />}>
        <ProfileSection params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return <p className="text-sm text-destructive">Persoana nu a fost găsită.</p>;
  }

  const family = await getFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [profileResult, documentsResult, consultationsResult, labsResult, connectionResult, writer] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, birth_date, idnp, notes")
        .eq("family_id", family.familyId)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, document_date, category, title, record_id",
        )
        .eq("profile_id", id)
        .order("document_date", { ascending: false }),
      supabase
        .from("consultations")
        .select(
          "id, profile_id, source_document_id, consultation_date, doctor_name, summary",
        )
        .eq("profile_id", id)
        .order("consultation_date", { ascending: false }),
      supabase
        .from("lab_tests")
        .select("id, profile_id, source_document_id, test_name, sample_date")
        .eq("profile_id", id)
        .order("sample_date", { ascending: false }),
      supabase
        .from("google_drive_connections")
        .select("family_id")
        .eq("family_id", family.familyId)
        .maybeSingle(),
      requireProfileWriter(id),
    ]);

  let documentsError = documentsResult.error;
  let documentsData = documentsResult.data;
  if (documentsError?.code === "42703" || documentsError?.code === "PGRST204") {
    const withRecord = await supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, document_date, category, record_id",
      )
      .eq("profile_id", id)
      .order("document_date", { ascending: false });
    if (!withRecord.error) {
      documentsError = null;
      documentsData = (withRecord.data ?? []).map((row) => ({ ...row, title: null }));
    } else {
      const retry = await supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, document_date, category",
        )
        .eq("profile_id", id)
        .order("document_date", { ascending: false });
      documentsError = retry.error;
      documentsData = (retry.data ?? []).map((row) => ({
        ...row,
        title: null,
        record_id: null,
      }));
    }
  }

  const listError =
    profileResult.error ??
    documentsError ??
    consultationsResult.error ??
    labsResult.error ??
    connectionResult.error;
  if (listError) {
    console.error("profilePage", listError.code);
    return (
      <p role="alert" className="text-sm text-destructive">
        Persoana nu a putut fi încărcată.
      </p>
    );
  }

  const profile = profileResult.data as {
    id: string;
    display_name: string;
    birth_date: string | null;
    idnp: string | null;
    notes: string | null;
  } | null;
  if (!profile) {
    return <p className="text-sm text-destructive">Persoana nu a fost găsită.</p>;
  }

  return (
    <ProfileDetail
      profile={profile}
      documents={(documentsData ?? []) as {
        id: string;
        profile_id: string;
        original_filename: string;
        document_date: string | null;
        category: string | null;
        title: string | null;
        record_id: string | null;
      }[]}
      consultations={(consultationsResult.data ?? []) as {
        id: string;
        profile_id: string;
        source_document_id: string | null;
        consultation_date: string;
        doctor_name: string | null;
        summary: string | null;
      }[]}
      labTests={(labsResult.data ?? []) as {
        id: string;
        profile_id: string;
        source_document_id: string | null;
        test_name: string;
        sample_date: string | null;
      }[]}
      driveConnected={Boolean(connectionResult.data)}
      canWrite={canWrite(family.role)}
      canEditRecords={Boolean(writer.familyId)}
      isAdmin={family.role === "admin"}
    />
  );
}
