import "server-only";

import { useProfileDocsCardCache } from "@/lib/data-cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileDocsCardInsurance = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  source_document_id: string | null;
  filename: string | null;
  mime_type: string | null;
};

export type ProfileDocsCardIdentity = {
  id: string;
  title: string;
  issued_date: string | null;
  notes: string | null;
  source_document_id: string | null;
  filename: string | null;
  mime_type: string | null;
};

export type ProfileDocsCard = {
  insurances: ProfileDocsCardInsurance[];
  identityDocs: ProfileDocsCardIdentity[];
  error: string | null;
};

function tableMissing(error: { code?: string; message?: string } | null, name: string) {
  if (!error) {
    return false;
  }
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").includes(name)
  );
}

/**
 * Insurance + identity card payload for a profile.
 * Cached until revalidateProfileDocsCard (add / update / delete on that card).
 */
export async function loadProfileDocsCard(
  familyId: string,
  profileId: string,
): Promise<ProfileDocsCard> {
  "use cache: private";
  useProfileDocsCardCache(profileId);

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (profileError) {
    console.error("loadProfileDocsCard", profileError.code);
    return {
      insurances: [],
      identityDocs: [],
      error: "Persoana nu a putut fi încărcată.",
    };
  }
  if (!profile) {
    return { insurances: [], identityDocs: [], error: null };
  }

  const [insurancesResult, identityDocsResult] = await Promise.all([
    supabase
      .from("medical_insurances")
      .select("id, title, start_date, end_date, notes, source_document_id")
      .eq("profile_id", profileId)
      .order("end_date", { ascending: false }),
    supabase
      .from("profile_identity_docs")
      .select("id, title, issued_date, notes, source_document_id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false }),
  ]);

  const insuranceMissing = tableMissing(
    insurancesResult.error,
    "medical_insurances",
  );
  const identityMissing = tableMissing(
    identityDocsResult.error,
    "profile_identity_docs",
  );

  if (
    (insurancesResult.error && !insuranceMissing) ||
    (identityDocsResult.error && !identityMissing)
  ) {
    console.error(
      "loadProfileDocsCard",
      insurancesResult.error?.code ?? identityDocsResult.error?.code,
    );
    return {
      insurances: [],
      identityDocs: [],
      error: "Persoana nu a putut fi încărcată.",
    };
  }

  const insuranceRows = insuranceMissing
    ? []
    : ((insurancesResult.data ?? []) as {
        id: string;
        title: string;
        start_date: string;
        end_date: string;
        notes: string | null;
        source_document_id: string | null;
      }[]);

  const identityRows = identityMissing
    ? []
    : ((identityDocsResult.data ?? []) as {
        id: string;
        title: string;
        issued_date: string | null;
        notes: string | null;
        source_document_id: string | null;
      }[]);

  const sourceIds = [
    ...new Set(
      [...insuranceRows, ...identityRows]
        .map((row) => row.source_document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const docsById = new Map<
    string,
    { original_filename: string; mime_type: string | null }
  >();

  if (sourceIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from("medical_documents")
      .select("id, original_filename, mime_type")
      .eq("profile_id", profileId)
      .in("id", sourceIds);

    if (docsError?.code === "42703" || docsError?.code === "PGRST204") {
      const retry = await supabase
        .from("medical_documents")
        .select("id, original_filename")
        .eq("profile_id", profileId)
        .in("id", sourceIds);
      for (const row of (retry.data ?? []) as {
        id: string;
        original_filename: string;
      }[]) {
        docsById.set(row.id, {
          original_filename: row.original_filename,
          mime_type: null,
        });
      }
    } else if (docsError) {
      console.error("loadProfileDocsCard", docsError.code);
      return {
        insurances: [],
        identityDocs: [],
        error: "Persoana nu a putut fi încărcată.",
      };
    } else {
      for (const row of (docs ?? []) as {
        id: string;
        original_filename: string;
        mime_type: string | null;
      }[]) {
        docsById.set(row.id, {
          original_filename: row.original_filename,
          mime_type: row.mime_type,
        });
      }
    }
  }

  return {
    insurances: insuranceRows.map((item) => {
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
    }),
    identityDocs: identityRows.map((item) => {
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
    }),
    error: null,
  };
}
