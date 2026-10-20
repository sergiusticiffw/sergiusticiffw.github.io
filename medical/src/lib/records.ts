import "server-only";

import type { RecordKind } from "@/app/(app)/profiles/document-actions";
import { useFamilyCache } from "@/lib/data-cache";
import { documentBody } from "@/lib/record-view";
import { createClient } from "@/lib/supabase/server";

export type FamilyRecordFile = {
  id: string;
  filename: string;
  mimeType: string | null;
};

export type FamilyRecord = {
  kind: RecordKind;
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  title: string;
  editTitle: string;
  editBody: string;
  body: string;
  files: FamilyRecordFile[];
};

const UUID = /^[0-9a-f-]{36}$/i;

function missingColumn(code: string | undefined) {
  return code === "42703" || code === "PGRST204";
}

async function profileName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  profileId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("family_id", familyId)
    .eq("id", profileId)
    .maybeSingle();
  const profile = data as { id: string; display_name: string } | null;
  return profile?.display_name ?? "Profil";
}

export async function loadFamilyRecord(
  familyId: string,
  id: string,
): Promise<{ record: FamilyRecord | null; error: string | null }> {
  "use cache: private";
  useFamilyCache();
  if (!UUID.test(id)) {
    return { record: null, error: "Înregistrarea nu a fost găsită." };
  }

  const supabase = await createClient();
  const withRecord = await supabase
    .from("medical_documents")
    .select(
      "id, profile_id, original_filename, mime_type, document_date, category, title, extracted_text, record_id",
    )
    .eq("id", id)
    .maybeSingle();
  let documentError = withRecord.error;
  let documentData = withRecord.data;
  if (missingColumn(documentError?.code)) {
    const retry = await supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, mime_type, document_date, category, extracted_text, record_id",
      )
      .eq("id", id)
      .maybeSingle();
    if (!retry.error) {
      documentError = null;
      documentData = retry.data ? { ...retry.data, title: null } : null;
    } else {
      const basic = await supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, mime_type, document_date, category, extracted_text",
        )
        .eq("id", id)
        .maybeSingle();
      documentError = basic.error;
      documentData = basic.data
        ? { ...basic.data, title: null, record_id: null }
        : null;
    }
  }

  if (documentError) {
    console.error("loadFamilyRecord", documentError.code);
    return { record: null, error: "Înregistrarea nu a putut fi încărcată." };
  }

  const document = documentData as {
    id: string;
    profile_id: string;
    original_filename: string;
    mime_type: string | null;
    document_date: string | null;
    category: string | null;
    title: string | null;
    extracted_text: string | null;
    record_id: string | null;
  } | null;

  if (document) {
    const primaryId = document.record_id || document.id;
    const extrasResult = await supabase
      .from("medical_documents")
      .select("id, original_filename, mime_type, record_id")
      .or(`id.eq.${primaryId},record_id.eq.${primaryId}`);
    const extras = extrasResult.error
      ? [{ id: document.id, original_filename: document.original_filename, mime_type: document.mime_type, record_id: document.record_id }]
      : ((extrasResult.data ?? []) as {
          id: string;
          original_filename: string;
          mime_type: string | null;
          record_id: string | null;
        }[]);
    const primary =
      extras.find((file) => file.id === primaryId) ?? {
        id: document.id,
        original_filename: document.original_filename,
        mime_type: document.mime_type,
        record_id: document.record_id,
      };
    const files = [
      primary,
      ...extras.filter((file) => file.record_id === primaryId),
    ];
    const primaryRow =
      document.id === primaryId
        ? document
        : ((
            await supabase
              .from("medical_documents")
              .select(
                "id, profile_id, original_filename, mime_type, document_date, category, title, extracted_text, record_id",
              )
              .eq("id", primaryId)
              .maybeSingle()
          ).data as typeof document) ?? document;

    const [consultations, labs] = await Promise.all([
      supabase
        .from("consultations")
        .select(
          "doctor_name, clinic_name, specialty, summary, recommendations",
        )
        .eq("source_document_id", primaryId)
        .maybeSingle(),
      supabase
        .from("lab_tests")
        .select(
          "test_name, result_value, result_text, unit, reference_text, laboratory",
        )
        .eq("source_document_id", primaryId),
    ]);

    const name = await profileName(supabase, familyId, primaryRow.profile_id);
    const body = documentBody({
      extractedText: primaryRow.extracted_text,
      consultation: consultations.data ?? null,
      labs: (labs.data ?? []) as {
        test_name: string;
        result_value: number | string | null;
        result_text: string | null;
        unit: string | null;
        reference_text: string | null;
        laboratory: string | null;
      }[],
    });
    const title =
      primaryRow.title?.trim() ||
      [
        primaryRow.category,
        files.length > 1 ? `${files.length} fișiere` : primaryRow.original_filename,
      ]
        .filter(Boolean)
        .join(" · ");

    return {
      record: {
        kind: "document",
        id: primaryId,
        profileId: primaryRow.profile_id,
        profileName: name,
        date: primaryRow.document_date,
        title,
        editTitle: primaryRow.title?.trim() || "",
        editBody: primaryRow.extracted_text?.trim() || "",
        body,
        files: files.map((file) => ({
          id: file.id,
          filename: file.original_filename,
          mimeType: file.mime_type,
        })),
      },
      error: null,
    };
  }

  const consultationResult = await supabase
    .from("consultations")
    .select(
      "id, profile_id, source_document_id, consultation_date, doctor_name, clinic_name, specialty, summary, recommendations",
    )
    .eq("id", id)
    .maybeSingle();
  if (consultationResult.error) {
    console.error("loadFamilyRecord", consultationResult.error.code);
    return { record: null, error: "Înregistrarea nu a putut fi încărcată." };
  }
  const consultation = consultationResult.data as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
    consultation_date: string;
    doctor_name: string | null;
    clinic_name: string | null;
    specialty: string | null;
    summary: string | null;
    recommendations: string | null;
  } | null;
  if (consultation) {
    if (consultation.source_document_id) {
      return loadFamilyRecord(familyId, consultation.source_document_id);
    }
    const name = await profileName(supabase, familyId, consultation.profile_id);
    const body = documentBody({
      extractedText: null,
      consultation,
      labs: [],
    }).replace(/^Consultație\n?/, "");
    return {
      record: {
        kind: "consultation",
        id: consultation.id,
        profileId: consultation.profile_id,
        profileName: name,
        date: consultation.consultation_date,
        title: ["Consultație", consultation.doctor_name].filter(Boolean).join(" · "),
        editTitle: "",
        editBody: consultation.summary?.trim() || "",
        body,
        files: [],
      },
      error: null,
    };
  }

  const labResult = await supabase
    .from("lab_tests")
    .select(
      "id, profile_id, source_document_id, test_name, sample_date, result_value, result_text, unit, reference_text, laboratory",
    )
    .eq("id", id)
    .maybeSingle();
  if (labResult.error) {
    console.error("loadFamilyRecord", labResult.error.code);
    return { record: null, error: "Înregistrarea nu a putut fi încărcată." };
  }
  const lab = labResult.data as {
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
  } | null;
  if (!lab) {
    return { record: null, error: "Înregistrarea nu a fost găsită." };
  }
  if (lab.source_document_id) {
    return loadFamilyRecord(familyId, lab.source_document_id);
  }
  const name = await profileName(supabase, familyId, lab.profile_id);
  const body = documentBody({
    extractedText: null,
    consultation: null,
    labs: [lab],
  }).replace(/^Analize\n?/, "");
  return {
    record: {
      kind: "lab",
      id: lab.id,
      profileId: lab.profile_id,
      profileName: name,
      date: lab.sample_date,
      title: ["Analiză", lab.test_name].filter(Boolean).join(" · "),
      editTitle: lab.test_name,
      editBody: lab.result_text?.trim() || "",
      body,
      files: [],
    },
    error: null,
  };
}
