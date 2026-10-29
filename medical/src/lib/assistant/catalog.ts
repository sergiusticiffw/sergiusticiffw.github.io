import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { useFamilyCache } from "@/lib/data-cache";
import { parseRecordCategory } from "@/lib/record-category";
import { createClient } from "@/lib/supabase/server";

export type CatalogPerson = {
  id: string;
  display_name: string;
};

export type CatalogRecord = {
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  category: string | null;
  title: string;
  fields: string;
  text: string;
  files: string[];
};

function missingColumn(code: string | undefined) {
  return code === "42703" || code === "PGRST204";
}

function fold(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function redactIndex(value: string) {
  return value
    .replace(/\bIDNP\s*:?\s*\d{13}\b/gi, " ")
    .replace(/\b\d{13}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldLines(entries: [string, string | number | null | undefined][]) {
  return entries
    .map(([label, value]) => {
      const text = redactIndex(String(value ?? "").trim()).slice(0, 400);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const MAX_SCANNED_TEXT = 8000;

function scannedText(values: (string | null | undefined)[]) {
  return redactIndex(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n\n"),
  ).slice(0, MAX_SCANNED_TEXT);
}

export async function loadMedicalCatalog(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{
  records: CatalogRecord[];
  people: CatalogPerson[];
  error: string | null;
}> {
  const [profilesResult, documentsResult, consultationsResult, labsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("family_id", familyId)
        .order("display_name", { ascending: true }),
      supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, document_date, category, title, record_id, extracted_text",
        )
        .order("document_date", { ascending: false }),
      supabase
        .from("consultations")
        .select(
          "id, profile_id, source_document_id, consultation_date, doctor_name, clinic_name, specialty, summary, recommendations",
        )
        .order("consultation_date", { ascending: false }),
      supabase
        .from("lab_tests")
        .select(
          "id, profile_id, source_document_id, test_name, sample_date, result_value, result_text, unit, reference_text, laboratory",
        )
        .order("sample_date", { ascending: false }),
    ]);

  let documentsError = documentsResult.error;
  let documentsData = documentsResult.data;
  if (missingColumn(documentsError?.code)) {
    const withText = await supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, document_date, category, record_id, extracted_text",
      )
      .order("document_date", { ascending: false });
    if (!withText.error) {
      documentsError = null;
      documentsData = (withText.data ?? []).map((row) => ({ ...row, title: null }));
    } else {
      const withRecord = await supabase
        .from("medical_documents")
        .select(
          "id, profile_id, original_filename, document_date, category, title, record_id",
        )
        .order("document_date", { ascending: false });
      if (!withRecord.error) {
        documentsError = null;
        documentsData = (withRecord.data ?? []).map((row) => ({
          ...row,
          extracted_text: null,
        }));
      } else {
        const retry = await supabase
          .from("medical_documents")
          .select("id, profile_id, original_filename, document_date, category")
          .order("document_date", { ascending: false });
        documentsError = retry.error;
        documentsData = (retry.data ?? []).map((row) => ({
          ...row,
          title: null,
          record_id: null,
          extracted_text: null,
        }));
      }
    }
  }

  let consultationsError = consultationsResult.error;
  let consultationsData = consultationsResult.data;
  if (missingColumn(consultationsError?.code)) {
    const retry = await supabase
      .from("consultations")
      .select(
        "id, profile_id, source_document_id, consultation_date, doctor_name, summary",
      )
      .order("consultation_date", { ascending: false });
    consultationsError = retry.error;
    consultationsData = (retry.data ?? []).map((row) => ({
      ...row,
      clinic_name: null,
      specialty: null,
      recommendations: null,
    }));
  }

  let labsError = labsResult.error;
  let labsData = labsResult.data;
  if (missingColumn(labsError?.code)) {
    const retry = await supabase
      .from("lab_tests")
      .select(
        "id, profile_id, source_document_id, test_name, sample_date, result_text",
      )
      .order("sample_date", { ascending: false });
    labsError = retry.error;
    labsData = (retry.data ?? []).map((row) => ({
      ...row,
      result_value: null,
      unit: null,
      reference_text: null,
      laboratory: null,
    }));
  }

  const listError =
    profilesResult.error ??
    documentsError ??
    consultationsError ??
    labsError;
  if (listError) {
    console.error("loadMedicalCatalog", listError.code);
    return {
      records: [],
      people: [],
      error: "Documentele nu au putut fi încărcate.",
    };
  }

  const profiles = (profilesResult.data ?? []) as {
    id: string;
    display_name: string;
  }[];
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const profileIds = new Set(profiles.map((profile) => profile.id));

  const consultations = ((consultationsData ?? []) as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
    consultation_date: string;
    doctor_name: string | null;
    clinic_name: string | null;
    specialty: string | null;
    summary: string | null;
    recommendations: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const labs = ((labsData ?? []) as {
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
  }[]).filter((item) => profileIds.has(item.profile_id));

  const documents = ((documentsData ?? []) as {
    id: string;
    profile_id: string;
    original_filename: string;
    document_date: string | null;
    category: string | null;
    title: string | null;
    record_id: string | null;
    extracted_text?: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const records: CatalogRecord[] = [];

  for (const item of documents.filter(
    (row) =>
      !row.record_id &&
      row.category !== "Asigurare" &&
      row.category !== "Act",
  )) {
    const files = [item, ...documents.filter((file) => file.record_id === item.id)];
    const consultation =
      consultations.find((row) => row.source_document_id === item.id) ?? null;
    const linkedLabs = labs.filter((row) => row.source_document_id === item.id);
    const title =
      item.title?.trim() ||
      [item.category, files.length > 1 ? `${files.length} fișiere` : item.original_filename]
        .filter(Boolean)
        .join(" · ");
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.document_date,
      category: item.category,
      title,
      fields: fieldLines([
        ["Persoană", names.get(item.profile_id)],
        ["Data", item.document_date],
        ["Titlu", title],
        ["Categorie", item.category],
        ["Fișier", files.map((file) => file.original_filename).join(", ")],
        ["Medic", consultation?.doctor_name],
        ["Clinică", consultation?.clinic_name],
        ["Specialitate", consultation?.specialty],
        ["Rezumat", consultation?.summary],
        ["Recomandări", consultation?.recommendations],
        [
          "Analize",
          linkedLabs
            .map((lab) =>
              [lab.test_name, lab.result_value, lab.unit, lab.result_text]
                .filter((part) => part !== null && part !== "")
                .join(" "),
            )
            .join("; "),
        ],
      ]),
      text: scannedText(files.map((file) => file.extracted_text)),
      files: files.map((file) => file.original_filename),
    });
  }

  for (const item of consultations.filter((row) => !row.source_document_id)) {
    const title = ["Consultație", item.doctor_name].filter(Boolean).join(" · ");
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.consultation_date,
      category: "Consultație",
      title,
      fields: fieldLines([
        ["Persoană", names.get(item.profile_id)],
        ["Data", item.consultation_date],
        ["Titlu", title],
        ["Medic", item.doctor_name],
        ["Clinică", item.clinic_name],
        ["Specialitate", item.specialty],
        ["Rezumat", item.summary],
        ["Recomandări", item.recommendations],
      ]),
      text: "",
      files: [],
    });
  }

  for (const item of labs.filter((row) => !row.source_document_id)) {
    const title = ["Analiză", item.test_name].filter(Boolean).join(" · ");
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.sample_date,
      category: "Analize",
      title,
      fields: fieldLines([
        ["Persoană", names.get(item.profile_id)],
        ["Data", item.sample_date],
        ["Titlu", title],
        ["Analiză", item.test_name],
        ["Valoare", item.result_value],
        ["Unitate", item.unit],
        ["Rezultat", item.result_text],
        ["Referință", item.reference_text],
        ["Laborator", item.laboratory],
      ]),
      text: "",
      files: [],
    });
  }

  records.sort((left, right) => {
    if (left.date === right.date) {
      return left.title.localeCompare(right.title, "ro");
    }
    if (!left.date) {
      return 1;
    }
    if (!right.date) {
      return -1;
    }
    return right.date.localeCompare(left.date);
  });

  return { records, people: profiles, error: null };
}

export type RecordIndexItem = {
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  title: string;
  category: string | null;
  snippet: string;
  search: string;
  fileCount: number;
};

function indexSearch(value: string) {
  return fold(redactIndex(value)).slice(0, 500);
}

export async function loadRecordsIndex(familyId: string): Promise<{
  records: RecordIndexItem[];
  people: CatalogPerson[];
  error: string | null;
}> {
  "use cache: private";
  useFamilyCache();
  const supabase = await createClient();
  const [profilesResult, documentsResult, consultationsResult, labsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("family_id", familyId)
        .order("display_name", { ascending: true }),
      supabase
        .from("medical_documents")
        .select("id, profile_id, original_filename, document_date, category, title, record_id")
        .order("document_date", { ascending: false }),
      supabase
        .from("consultations")
        .select(
          "id, profile_id, source_document_id, consultation_date, doctor_name, summary",
        )
        .order("consultation_date", { ascending: false }),
      supabase
        .from("lab_tests")
        .select("id, profile_id, source_document_id, test_name, category, sample_date")
        .order("sample_date", { ascending: false }),
    ]);

  let documentsError = documentsResult.error;
  let documentsData = documentsResult.data;
  if (missingColumn(documentsError?.code)) {
    const withRecord = await supabase
      .from("medical_documents")
      .select("id, profile_id, original_filename, document_date, category, record_id")
      .order("document_date", { ascending: false });
    if (!withRecord.error) {
      documentsError = null;
      documentsData = (withRecord.data ?? []).map((row) => ({ ...row, title: null }));
    } else {
      const retry = await supabase
        .from("medical_documents")
        .select("id, profile_id, original_filename, document_date, category")
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
    profilesResult.error ??
    documentsError ??
    consultationsResult.error ??
    labsResult.error;
  if (listError) {
    console.error("loadRecordsIndex", listError.code);
    return {
      records: [],
      people: [],
      error: "Documentele nu au putut fi încărcate.",
    };
  }

  const profiles = (profilesResult.data ?? []) as CatalogPerson[];
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const profileIds = new Set(profiles.map((profile) => profile.id));

  const consultations = ((consultationsResult.data ?? []) as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
    consultation_date: string;
    doctor_name: string | null;
    summary: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const labs = ((labsResult.data ?? []) as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
    test_name: string;
    category: string | null;
    sample_date: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const documents = ((documentsData ?? []) as {
    id: string;
    profile_id: string;
    original_filename: string;
    document_date: string | null;
    category: string | null;
    title: string | null;
    record_id: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const records: RecordIndexItem[] = [];

  for (const item of documents.filter(
    (row) =>
      !row.record_id &&
      row.category !== "Asigurare" &&
      row.category !== "Act",
  )) {
    const files = [item, ...documents.filter((file) => file.record_id === item.id)];
    const consultation =
      consultations.find((row) => row.source_document_id === item.id) ?? null;
    const labNames = labs
      .filter((row) => row.source_document_id === item.id)
      .map((row) => row.test_name);
    const title =
      item.title?.trim() ||
      [item.category, files.length > 1 ? `${files.length} fișiere` : item.original_filename]
        .filter(Boolean)
        .join(" · ");
    const snippet = redactIndex(
      [consultation?.summary, labNames.join(" "), files.map((file) => file.original_filename).join(" ")]
        .filter(Boolean)
        .join(" "),
    ).slice(0, 220);
    const category = parseRecordCategory(
      item.category || (labNames.length > 0 ? "Analiză" : "Consultație"),
    );
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.document_date,
      title,
      category,
      snippet,
      search: indexSearch(
        `${title} ${category} ${names.get(item.profile_id) ?? ""} ${consultation?.doctor_name ?? ""} ${snippet}`,
      ),
      fileCount: files.length,
    });
  }

  for (const item of consultations.filter((row) => !row.source_document_id)) {
    const title = ["Consultație", item.doctor_name].filter(Boolean).join(" · ");
    const snippet = redactIndex(item.summary ?? "").slice(0, 220);
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.consultation_date,
      title,
      category: "Consultație",
      snippet,
      search: indexSearch(
        `${title} Consultație ${names.get(item.profile_id) ?? ""} ${snippet}`,
      ),
      fileCount: 0,
    });
  }

  for (const item of labs.filter((row) => !row.source_document_id)) {
    const category = parseRecordCategory(item.category || "Analiză");
    const title = ["Analiză", item.test_name].filter(Boolean).join(" · ");
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date: item.sample_date,
      title,
      category,
      snippet: "",
      search: indexSearch(
        `${title} ${category} ${names.get(item.profile_id) ?? ""}`,
      ),
      fileCount: 0,
    });
  }

  records.sort((left, right) => {
    if (left.date === right.date) {
      return left.title.localeCompare(right.title, "ro");
    }
    if (!left.date) {
      return 1;
    }
    if (!right.date) {
      return -1;
    }
    return right.date.localeCompare(left.date);
  });

  return { records, people: profiles, error: null };
}

const STOP_WORDS = new Set([
  "din",
  "in",
  "de",
  "la",
  "pe",
  "cu",
  "si",
  "sau",
  "ce",
  "care",
  "sunt",
  "este",
  "pentru",
  "despre",
  "document",
  "documentul",
  "documentele",
  "arata",
  "cauta",
  "rezuma",
  "ultimele",
  "luna",
  "dosar",
  "dosarul",
  "scrie",
  "text",
  "textul",
  "lui",
  "ei",
  "lor",
  "informatie",
  "informatii",
  "exista",
  "afla",
  "spune",
]);

function contentTerms(query: string) {
  return fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    .slice(0, 8);
}

function excerptAround(text: string, terms: string[]) {
  const folded = fold(text);
  let index = -1;
  for (const term of terms) {
    const found = folded.indexOf(term);
    if (found >= 0 && (index < 0 || found < index)) {
      index = found;
    }
  }
  if (index < 0) {
    return text.slice(0, 700);
  }
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + 520);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function topicFromText(text: string) {
  const cleaned = text
    .replace(/\bIDNP\s*:?\s*\d{13}\b/gi, " ")
    .replace(/\d{13}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((word) => word.length > 1);
  const slice = words.slice(0, 8).join(" ").replace(/[«»"]/g, "");
  if (slice.length < 12) {
    return "";
  }
  return slice.slice(0, 80);
}

export function suggestQuestions(records: CatalogRecord[]) {
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (questions.length >= 4) {
      break;
    }
    const topic = topicFromText(record.fields);
    if (!topic) {
      continue;
    }
    const question = record.profileName.trim()
      ? `Ce scrie despre „${topic}” la ${record.profileName.trim()}?`
      : `Ce scrie despre „${topic}”?`;
    const key = fold(question);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    questions.push(question);
  }
  return questions;
}

export function searchCatalog(
  records: CatalogRecord[],
  filters: {
    query?: string;
    profile?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
) {
  const query = (filters.query ?? "").trim().slice(0, 160);
  const terms = contentTerms(query);
  const profile = fold(filters.profile ?? "").trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "") ? filters.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "") ? filters.to! : "";
  const limit = Math.min(Math.max(Number(filters.limit) || 12, 1), 30);

  const scored = records
    .map((record) => {
      if (profile && !fold(record.profileName).includes(profile)) {
        return null;
      }
      if (from && (!record.date || record.date < from)) {
        return null;
      }
      if (to && (!record.date || record.date > to)) {
        return null;
      }
      if (terms.length === 0) {
        return { record, hits: 0 };
      }
      const haystack = fold(
        `${record.title}\n${record.profileName}\n${record.category ?? ""}\n${record.fields}\n${record.text}`,
      );
      const hits = terms.filter((term) => {
        if (haystack.includes(term)) {
          return true;
        }
        return term.length >= 6 && haystack.includes(term.slice(0, 5));
      }).length;
      const needed = Math.max(1, Math.ceil(terms.length / 2));
      return hits >= needed ? { record, hits } : null;
    })
    .filter((item): item is { record: CatalogRecord; hits: number } => item !== null)
    .sort((left, right) => right.hits - left.hits);

  return {
    total: scored.length,
    records: scored.slice(0, limit).map(({ record }) => ({
      id: record.id,
      profile: record.profileName,
      date: record.date,
      title: record.title,
      excerpt: excerptAround(
        record.text ? `${record.fields}\n\n${record.text}` : record.fields,
        terms,
      ),
    })),
  };
}
