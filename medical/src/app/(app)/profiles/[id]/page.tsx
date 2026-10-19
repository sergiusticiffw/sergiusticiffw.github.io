import { Suspense } from "react";
import Link from "next/link";

import { ProfileDetail } from "@/components/profiles/profile-list";
import { getAdminFamilyId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Persoană",
};

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Se încarcă persoana…</p>}
    >
      <ProfileSection params={params} />
    </Suspense>
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

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [profileResult, documentsResult, consultationsResult, labsResult, connectionResult] =
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
          "id, profile_id, original_filename, mime_type, document_date, category, title, extracted_text, record_id",
        )
        .eq("profile_id", id)
        .order("document_date", { ascending: false }),
      supabase
        .from("consultations")
        .select(
          "id, profile_id, source_document_id, consultation_date, doctor_name, clinic_name, specialty, summary, recommendations",
        )
        .eq("profile_id", id)
        .order("consultation_date", { ascending: false }),
      supabase
        .from("lab_tests")
        .select(
          "id, profile_id, source_document_id, test_name, sample_date, result_value, result_text, unit, reference_text, laboratory",
        )
        .eq("profile_id", id)
        .order("sample_date", { ascending: false }),
      supabase
        .from("google_drive_connections")
        .select("family_id")
        .eq("family_id", family.familyId)
        .maybeSingle(),
    ]);

  let documentsError = documentsResult.error;
  let documentsData = documentsResult.data;
  if (documentsError?.code === "42703" || documentsError?.code === "PGRST204") {
    const withRecord = await supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, mime_type, document_date, category, extracted_text, record_id",
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
          "id, profile_id, original_filename, mime_type, document_date, category, extracted_text",
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
    <div className="flex flex-col gap-4">
      <Link href="/profiles" className="text-sm text-muted-foreground hover:underline">
        Toate persoanele
      </Link>
      <ProfileDetail
        profile={profile}
        documents={(documentsData ?? []) as {
          id: string;
          profile_id: string;
          original_filename: string;
          mime_type: string | null;
          document_date: string | null;
          category: string | null;
          title: string | null;
          extracted_text: string | null;
          record_id: string | null;
        }[]}
        consultations={(consultationsResult.data ?? []) as {
          id: string;
          profile_id: string;
          source_document_id: string | null;
          consultation_date: string;
          doctor_name: string | null;
          clinic_name: string | null;
          specialty: string | null;
          summary: string | null;
          recommendations: string | null;
        }[]}
        labTests={(labsResult.data ?? []) as {
          id: string;
          profile_id: string;
          source_document_id: string | null;
          test_name: string;
          sample_date: string | null;
          result_value: number | string | null;
          result_text: string | null;
          unit: string | null;
          reference_text: string | null;
          laboratory: string | null;
        }[]}
        driveConnected={Boolean(connectionResult.data)}
      />
    </div>
  );
}
