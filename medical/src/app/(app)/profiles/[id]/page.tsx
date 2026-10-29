import { Suspense } from "react";
import Link from "next/link";

import { PageFallback } from "@/components/layout/page-fallback";
import { ProfileDetail } from "@/components/profiles/profile-list";
import { canWrite, getPageFamilyAccess, requireProfileWriter } from "@/lib/auth";
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

  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [
    profileResult,
    documentsResult,
    consultationsResult,
    labsResult,
    insurancesResult,
    identityDocsResult,
    connectionResult,
    writer,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, birth_date, idnp, notes")
        .eq("family_id", family.familyId)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, document_date, category, title, record_id, mime_type",
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
        .from("medical_insurances")
        .select(
          "id, title, start_date, end_date, notes, source_document_id",
        )
        .eq("profile_id", id)
        .order("end_date", { ascending: false }),
      supabase
        .from("profile_identity_docs")
        .select("id, title, issued_date, notes, source_document_id")
        .eq("profile_id", id)
        .order("created_at", { ascending: false }),
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
      documentsData = (withRecord.data ?? []).map((row) => ({
        ...row,
        title: null,
        mime_type: null,
      }));
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
        mime_type: null,
      }));
    }
  }

  const insuranceMissing =
    insurancesResult.error?.code === "42P01" ||
    insurancesResult.error?.code === "PGRST205" ||
    (insurancesResult.error?.message ?? "").includes("medical_insurances");
  const identityMissing =
    identityDocsResult.error?.code === "42P01" ||
    identityDocsResult.error?.code === "PGRST205" ||
    (identityDocsResult.error?.message ?? "").includes("profile_identity_docs");

  const listError =
    profileResult.error ??
    documentsError ??
    consultationsResult.error ??
    labsResult.error ??
    (insuranceMissing ? null : insurancesResult.error) ??
    (identityMissing ? null : identityDocsResult.error) ??
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

  const documents = (documentsData ?? []) as {
    id: string;
    profile_id: string;
    original_filename: string;
    document_date: string | null;
    category: string | null;
    title: string | null;
    record_id: string | null;
    mime_type: string | null;
  }[];
  const docsById = new Map(documents.map((doc) => [doc.id, doc]));
  const insurances = insuranceMissing
    ? []
    : ((insurancesResult.data ?? []) as {
        id: string;
        title: string;
        start_date: string;
        end_date: string;
        notes: string | null;
        source_document_id: string | null;
      }[]).map((item) => {
        const file = item.source_document_id
          ? docsById.get(item.source_document_id)
          : null;
        return {
          id: item.id,
          title: item.title,
          start_date: item.start_date,
          end_date: item.end_date,
          notes: item.notes,
          source_document_id: item.source_document_id,
          filename: file?.original_filename ?? null,
          mime_type: file?.mime_type ?? null,
        };
      });

  const identityDocs = identityMissing
    ? []
    : ((identityDocsResult.data ?? []) as {
        id: string;
        title: string;
        issued_date: string | null;
        notes: string | null;
        source_document_id: string | null;
      }[]).map((item) => {
        const file = item.source_document_id
          ? docsById.get(item.source_document_id)
          : null;
        return {
          id: item.id,
          title: item.title,
          issued_date: item.issued_date,
          notes: item.notes,
          source_document_id: item.source_document_id,
          filename: file?.original_filename ?? null,
          mime_type: file?.mime_type ?? null,
        };
      });

  return (
    <ProfileDetail
      profile={profile}
      documents={documents}
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
      insurances={insurances}
      identityDocs={identityDocs}
      driveConnected={Boolean(connectionResult.data)}
      canWrite={canWrite(family.role)}
      canEditRecords={Boolean(writer.familyId)}
      isAdmin={family.role === "admin"}
    />
  );
}
