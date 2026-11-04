import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildMedicalDigest } from "@/lib/assistant/medical-digest";
import {
  MONTHS,
  fold,
  matchesCategory,
  parsePeriodHints,
  resolveProfiles,
} from "@/lib/assistant/query";
import { useFamilyCache } from "@/lib/data-cache";
import { parseRecordCategory } from "@/lib/record-category";
import { createClient } from "@/lib/supabase/server";

export { parsePeriodHints, resolveProfiles } from "@/lib/assistant/query";

export type CatalogPerson = {
  id: string;
  display_name: string;
  allergies?: string | null;
  chronic_conditions?: string | null;
  current_medications?: string | null;
  blood_type?: string | null;
  emergency_notes?: string | null;
};

export type CatalogLab = {
  name: string;
  value: number | string | null;
  unit: string | null;
  text: string | null;
  date: string | null;
};

export type CatalogRecord = {
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  category: string | null;
  title: string;
  fields: string;
  /** Short OCR preview used for search matching. */
  text: string;
  /** Longer OCR payload returned by read_record. */
  fullText: string;
  files: string[];
  href: string | null;
  labs: CatalogLab[];
};

function missingColumn(code: string | undefined) {
  return code === "42703" || code === "PGRST204";
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
      const text = redactIndex(String(value ?? "").trim()).slice(0, 280);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Cap OCR digest used when searching the catalog. */
const MAX_SEARCH_TEXT = 3500;
/** Cap OCR digest returned when reading a record into the model. */
const MAX_READ_TEXT = 12_000;
/** Raw OCR joined before digest (keeps room for conclusions past page 1). */
const MAX_RAW_OCR = 60_000;
/** Cap catalog size for large families (newest first after sort). */
const MAX_CATALOG_RECORDS = 80;
/** Soft cap on documents fetched before grouping. */
const MAX_DOCUMENTS_FETCH = 200;

function scannedText(values: (string | null | undefined)[]) {
  return redactIndex(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n\n"),
  ).slice(0, MAX_RAW_OCR);
}

function digestForAssistant(values: (string | null | undefined)[], max: number) {
  return buildMedicalDigest(scannedText(values), max);
}

function inferDateFromText(value: string): string | null {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dmy = value.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (!dmy) {
    return null;
  }
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function documentHref(documentId: string) {
  return `/records/${documentId}`;
}

function profileHref(profileId: string) {
  return `/profiles/${profileId}`;
}

export async function loadMedicalCatalog(
  supabase: SupabaseClient,
  familyId: string,
  period?: { from?: string; to?: string },
): Promise<{
  records: CatalogRecord[];
  people: CatalogPerson[];
  error: string | null;
}> {
  const periodFrom =
    period?.from && /^\d{4}-\d{2}-\d{2}$/.test(period.from) ? period.from : "";
  const periodTo =
    period?.to && /^\d{4}-\d{2}-\d{2}$/.test(period.to) ? period.to : "";

  const documentSelect =
    "id, profile_id, original_filename, document_date, category, title, record_id, extracted_text, created_at";

  const recentDocumentsQuery = supabase
    .from("medical_documents")
    .select(documentSelect)
    .order("document_date", { ascending: false })
    .limit(MAX_DOCUMENTS_FETCH);

  const periodDocumentsQuery =
    periodFrom || periodTo
      ? (() => {
          let query = supabase
            .from("medical_documents")
            .select(documentSelect)
            .order("document_date", { ascending: false })
            .limit(MAX_DOCUMENTS_FETCH);
          if (periodFrom) {
            query = query.gte("document_date", periodFrom);
          }
          if (periodTo) {
            query = query.lte("document_date", periodTo);
          }
          return query;
        })()
      : null;

  const consultationSelect =
    "id, profile_id, source_document_id, consultation_date, doctor_name, clinic_name, specialty, summary, recommendations";
  const labSelect =
    "id, profile_id, source_document_id, test_name, sample_date, result_value, result_text, unit, reference_text, laboratory";

  const recentConsultationsQuery = supabase
    .from("consultations")
    .select(consultationSelect)
    .order("consultation_date", { ascending: false })
    .limit(MAX_CATALOG_RECORDS);
  const periodConsultationsQuery =
    periodFrom || periodTo
      ? (() => {
          let query = supabase
            .from("consultations")
            .select(consultationSelect)
            .order("consultation_date", { ascending: false })
            .limit(MAX_CATALOG_RECORDS);
          if (periodFrom) {
            query = query.gte("consultation_date", periodFrom);
          }
          if (periodTo) {
            query = query.lte("consultation_date", periodTo);
          }
          return query;
        })()
      : null;

  const recentLabsQuery = supabase
    .from("lab_tests")
    .select(labSelect)
    .order("sample_date", { ascending: false })
    .limit(MAX_CATALOG_RECORDS);
  const periodLabsQuery =
    periodFrom || periodTo
      ? (() => {
          let query = supabase
            .from("lab_tests")
            .select(labSelect)
            .order("sample_date", { ascending: false })
            .limit(MAX_CATALOG_RECORDS);
          if (periodFrom) {
            query = query.gte("sample_date", periodFrom);
          }
          if (periodTo) {
            query = query.lte("sample_date", periodTo);
          }
          return query;
        })()
      : null;

  const emptyResult = Promise.resolve({ data: null, error: null });

  const [
    profilesResult,
    documentsResult,
    periodDocumentsResult,
    consultationsResult,
    periodConsultationsResult,
    labsResult,
    periodLabsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, allergies, chronic_conditions, current_medications, blood_type, emergency_notes",
      )
      .eq("family_id", familyId)
      .order("display_name", { ascending: true }),
    recentDocumentsQuery,
    periodDocumentsQuery ?? emptyResult,
    recentConsultationsQuery,
    periodConsultationsQuery ?? emptyResult,
    recentLabsQuery,
    periodLabsQuery ?? emptyResult,
  ]);

  function mergeRows<T extends { id: string }>(
    ...groups: (T[] | null | undefined)[]
  ) {
    const byId = new Map<string, T>();
    for (const group of groups) {
      for (const row of group ?? []) {
        byId.set(row.id, row);
      }
    }
    return [...byId.values()];
  }

  const documentsError = documentsResult.error ?? periodDocumentsResult.error;
  const documentsData = mergeRows(
    documentsResult.data,
    periodDocumentsResult.data,
  );
  if (missingColumn(documentsError?.code)) {
    return {
      records: [],
      people: [],
      error:
        "Aplică migrațiile pentru titlu, text extras și imaginile din înregistrare.",
    };
  }

  let profilesError = profilesResult.error;
  let profilesData = profilesResult.data;
  if (missingColumn(profilesError?.code)) {
    const retry = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("family_id", familyId)
      .order("display_name", { ascending: true });
    profilesError = retry.error;
    profilesData = (retry.data ?? []).map((row) => ({
      ...row,
      allergies: null,
      chronic_conditions: null,
      current_medications: null,
      blood_type: null,
      emergency_notes: null,
    }));
  }

  let consultationsError =
    consultationsResult.error ?? periodConsultationsResult.error;
  let consultationsData = mergeRows(
    consultationsResult.data,
    periodConsultationsResult.data,
  );
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

  let labsError = labsResult.error ?? periodLabsResult.error;
  let labsData = mergeRows(labsResult.data, periodLabsResult.data);
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
    profilesError ??
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

  const profiles = (profilesData ?? []) as CatalogPerson[];
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
    created_at?: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const records: CatalogRecord[] = [];

  for (const person of profiles) {
    const fields = fieldLines([
      ["Persoană", person.display_name],
      ["Grup sanguin", person.blood_type],
      ["Alergii", person.allergies],
      ["Boli cronice", person.chronic_conditions],
      ["Medicamente", person.current_medications],
      ["Note urgență", person.emergency_notes],
    ]);
    if (!fields) {
      continue;
    }
    records.push({
      id: `health:${person.id}`,
      profileId: person.id,
      profileName: person.display_name,
      date: null,
      category: "Urgență",
      title: `Card de urgență · ${person.display_name}`,
      fields,
      text: "",
      fullText: "",
      files: [],
      href: profileHref(person.id),
      labs: [],
    });
  }

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
    const ocrParts = files.map((file) => file.extracted_text);
    const fullText = digestForAssistant(ocrParts, MAX_READ_TEXT);
    const searchText = digestForAssistant(ocrParts, MAX_SEARCH_TEXT);
    const createdDay = item.created_at?.slice(0, 10) || null;
    const date =
      item.document_date ||
      inferDateFromText(
        `${item.title ?? ""}\n${files.map((file) => file.extracted_text ?? "").join("\n")}`,
      ) ||
      (/^\d{4}-\d{2}-\d{2}$/.test(createdDay ?? "") ? createdDay : null);
    const recordLabs: CatalogLab[] = linkedLabs.map((lab) => ({
      name: lab.test_name,
      value: lab.result_value,
      unit: lab.unit,
      text: lab.result_text,
      date: lab.sample_date || date,
    }));
    records.push({
      id: item.id,
      profileId: item.profile_id,
      profileName: names.get(item.profile_id) ?? "Profil",
      date,
      category: item.category,
      title,
      fields: fieldLines([
        ["Persoană", names.get(item.profile_id)],
        ["Data", date],
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
      text: searchText,
      fullText,
      files: files.map((file) => file.original_filename),
      href: documentHref(item.id),
      labs: recordLabs,
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
      fullText: "",
      files: [],
      href: profileHref(item.profile_id),
      labs: [],
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
      fullText: "",
      files: [],
      href: profileHref(item.profile_id),
      labs: [
        {
          name: item.test_name,
          value: item.result_value,
          unit: item.unit,
          text: item.result_text,
          date: item.sample_date,
        },
      ],
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

  // Keep period matches even when the family has many newer records.
  const periodCap = Math.max(MAX_CATALOG_RECORDS, 150);
  const selected =
    periodFrom || periodTo
      ? (() => {
          const inPeriod = records.filter((record) =>
            matchesPeriod(record, periodFrom, periodTo),
          );
          const extras = records.filter(
            (record) => !inPeriod.some((item) => item.id === record.id),
          );
          return [...inPeriod, ...extras].slice(0, periodCap);
        })()
      : records.slice(0, MAX_CATALOG_RECORDS);

  return {
    records: selected,
    people: profiles,
    error: null,
  };
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
        .order("document_date", { ascending: false })
        .limit(400),
      supabase
        .from("consultations")
        .select(
          "id, profile_id, source_document_id, consultation_date, doctor_name, summary",
        )
        .order("consultation_date", { ascending: false })
        .limit(200),
      supabase
        .from("lab_tests")
        .select("id, profile_id, source_document_id, test_name, category, sample_date")
        .order("sample_date", { ascending: false })
        .limit(200),
    ]);

  const documentsError = documentsResult.error;
  const documentsData = documentsResult.data;
  if (missingColumn(documentsError?.code)) {
    return {
      records: [],
      people: [],
      error:
        "Aplică migrațiile pentru titlu și imaginile din înregistrare.",
    };
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
  "raport",
  "rapoarte",
  "inregistrare",
  "inregistrari",
  "analize",
  "analiza",
  "consultatie",
  "consultatii",
  "lista",
  "toate",
  "tot",
  "am",
  "avem",
  "avut",
  "arata",
  "cauta",
  "rezuma",
  "ultimele",
  "luna",
  "anul",
  "an",
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
  ...Object.keys(MONTHS),
]);

/** Undated rows stay if OCR/fields mention the period; dated rows use ISO bounds. */
function matchesPeriod(record: CatalogRecord, from: string, to: string) {
  if (record.date) {
    if (from && record.date < from) {
      return false;
    }
    if (to && record.date > to) {
      return false;
    }
    return true;
  }
  if (!from && !to) {
    return true;
  }
  const haystack = fold(
    `${record.title}\n${record.fields}\n${record.text}\n${record.fullText}`,
  );
  const anchor = from || to;
  const year = anchor.slice(0, 4);
  if (year && !haystack.includes(year)) {
    return false;
  }
  const monthNum = anchor.slice(5, 7);
  const month = Number(monthNum);
  if (!month) {
    return true;
  }
  if (haystack.includes(`${year}-${monthNum}`)) {
    return true;
  }
  if (
    haystack.includes(`${monthNum}.${year}`) ||
    haystack.includes(`${monthNum}/${year}`) ||
    haystack.includes(`${Number(monthNum)}.${year}`) ||
    haystack.includes(`${Number(monthNum)}/${year}`)
  ) {
    return true;
  }
  for (const [name, value] of Object.entries(MONTHS)) {
    if (value === month && name.length > 3 && haystack.includes(name)) {
      return true;
    }
  }
  return false;
}

function contentTerms(query: string) {
  return fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (term) =>
        term.length >= 3 &&
        !STOP_WORDS.has(term) &&
        !/^20\d{2}$/.test(term) &&
        !/^\d{1,2}$/.test(term),
    )
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
  const push = (question: string) => {
    const key = fold(question);
    if (seen.has(key) || questions.length >= 4) {
      return;
    }
    seen.add(key);
    questions.push(question);
  };

  const withLabs = records.filter((record) => record.labs.length > 0);
  if (withLabs.length >= 2) {
    const labName = withLabs[0]?.labs[0]?.name?.trim();
    const person = withLabs[0]?.profileName?.trim();
    if (labName && person) {
      push(`Cum a evoluat ${labName} la ${person}?`);
    }
  }

  for (const record of records) {
    if (questions.length >= 4) {
      break;
    }
    const topic = topicFromText(record.fields);
    if (!topic) {
      continue;
    }
    push(
      record.profileName.trim()
        ? `Ce scrie despre „${topic}” la ${record.profileName.trim()}?`
        : `Ce scrie despre „${topic}”?`,
    );
  }
  return questions;
}

export function suggestFromIndex(
  records: RecordIndexItem[],
  people: CatalogPerson[],
) {
  const questions: string[] = [];
  const seen = new Set<string>();
  const push = (question: string) => {
    const key = fold(question);
    if (!question.trim() || seen.has(key) || questions.length >= 4) {
      return;
    }
    seen.add(key);
    questions.push(question);
  };

  const dated = records.find((record) => record.date);
  if (dated?.date) {
    const [year, month] = dated.date.split("-");
    const monthName = Object.entries(MONTHS).find(
      ([name, value]) =>
        value === Number(month) && name.length > 3,
    )?.[0];
    if (monthName && year) {
      push(`Rezumă ${monthName} ${year}`);
      push(`Ce rapoarte am în ${monthName} ${year}?`);
    }
  }

  for (const person of people.slice(0, 2)) {
    push(`Ce documente recente are ${person.display_name}?`);
  }

  for (const record of records.slice(0, 8)) {
    if (!record.title.trim()) {
      continue;
    }
    const shortTitle = record.title.trim().slice(0, 60);
    push(
      record.profileName.trim()
        ? `Ce scrie în „${shortTitle}” la ${record.profileName.trim()}?`
        : `Ce scrie în „${shortTitle}”?`,
    );
  }

  if (records.some((record) => /analiz/i.test(record.category ?? ""))) {
    push("Compară analizele recente din dosar.");
  }

  return questions.slice(0, 4);
}

export function readHealthCard(
  records: CatalogRecord[],
  people: CatalogPerson[],
  profile?: string,
) {
  const cards = records.filter((record) => record.id.startsWith("health:"));
  if (!profile?.trim()) {
    return {
      total: cards.length,
      records: cards.map((record) => ({
        id: record.id,
        profile: record.profileName,
        title: record.title,
        href: record.href,
        fields: record.fields,
      })),
    };
  }

  const resolved = resolveProfiles(people, profile);
  if (resolved.ambiguous) {
    return {
      ambiguous: true,
      message: "Mai multe persoane se potrivesc. Clarifică despre cine întrebi.",
      candidates: resolved.ambiguous.map((person) => person.display_name),
    };
  }
  if (resolved.none) {
    return { error: `Nu am găsit persoana „${profile.trim()}” în familie.` };
  }
  const match = resolved.match!;
  const card =
    cards.find((record) => record.profileId === match.id) ??
    cards.find((record) => fold(record.profileName).includes(fold(match.display_name)));
  if (!card) {
    return { error: `Nu există card de urgență pentru ${match.display_name}.` };
  }
  return {
    total: 1,
    records: [
      {
        id: card.id,
        profile: card.profileName,
        title: card.title,
        href: card.href,
        fields: card.fields,
      },
    ],
  };
}

export function compareLabs(
  records: CatalogRecord[],
  filters: {
    query?: string;
    profile?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
  people: CatalogPerson[] = [],
) {
  const query = fold((filters.query ?? "").trim()).slice(0, 80);
  if (!query) {
    return { error: "Indică numele analizei (ex. hemoglobină, TSH)." };
  }
  const terms = query
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 2)
    .slice(0, 6);
  let profileFilter = fold(filters.profile ?? "").trim();
  if (filters.profile?.trim() && people.length > 0) {
    const resolved = resolveProfiles(people, filters.profile);
    if (resolved.ambiguous) {
      return {
        ambiguous: true,
        message: "Mai multe persoane se potrivesc. Clarifică despre cine întrebi.",
        candidates: resolved.ambiguous.map((person) => person.display_name),
      };
    }
    if (resolved.none) {
      return { error: `Nu am găsit persoana „${filters.profile.trim()}” în familie.` };
    }
    profileFilter = fold(resolved.match!.display_name);
  }
  const period = parsePeriodHints(filters.query ?? "");
  const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "")
    ? filters.from!
    : period.from ?? "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "")
    ? filters.to!
    : period.to ?? "";
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 40);

  const points = records.flatMap((record) => {
    if (profileFilter && !fold(record.profileName).includes(profileFilter)) {
      return [];
    }
    if ((from || to) && !matchesPeriod(record, from, to)) {
      return [];
    }
    return record.labs
      .filter((lab) => {
        const name = fold(lab.name);
        return terms.every((term) => name.includes(term) || term.includes(name.slice(0, 5)));
      })
      .map((lab) => ({
        id: record.id,
        profile: record.profileName,
        date: lab.date || record.date,
        title: record.title,
        href: record.href,
        name: lab.name,
        value: lab.value,
        unit: lab.unit,
        text: lab.text,
      }));
  });

  points.sort((left, right) => {
    const leftDate = left.date ?? "";
    const rightDate = right.date ?? "";
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    return left.name.localeCompare(right.name, "ro");
  });

  return {
    total: points.length,
    results: points.slice(0, limit),
  };
}

export function searchCatalog(
  records: CatalogRecord[],
  filters: {
    query?: string;
    profile?: string;
    category?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
  people: CatalogPerson[] = [],
) {
  const query = (filters.query ?? "").trim().slice(0, 160);
  const period = parsePeriodHints(query);
  const terms = contentTerms(query);
  let profileFilter = fold(filters.profile ?? "").trim();
  if (filters.profile?.trim() && people.length > 0) {
    const resolved = resolveProfiles(people, filters.profile);
    if (resolved.ambiguous) {
      return {
        total: 0,
        ambiguous: true as const,
        message: "Mai multe persoane se potrivesc. Clarifică despre cine întrebi.",
        candidates: resolved.ambiguous.map((person) => person.display_name),
        records: [],
      };
    }
    if (resolved.none) {
      return {
        total: 0,
        error: `Nu am găsit persoana „${filters.profile.trim()}” în familie.`,
        records: [],
      };
    }
    profileFilter = fold(resolved.match!.display_name);
  }
  const category = (filters.category ?? "").trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "")
    ? filters.from!
    : period.from ?? "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "")
    ? filters.to!
    : period.to ?? "";
  const defaultLimit = terms.length === 0 && (from || to) ? 30 : 12;
  const limit = Math.min(
    Math.max(Number(filters.limit) || defaultLimit, 1),
    30,
  );

  const scored = records
    .map((record) => {
      if (profileFilter && !fold(record.profileName).includes(profileFilter)) {
        return null;
      }
      if (category && !matchesCategory(record.category, record.title, category)) {
        return null;
      }
      if ((from || to) && !matchesPeriod(record, from, to)) {
        return null;
      }
      // Listing by period ("rapoarte din octombrie") has no useful text terms —
      // return every record in the date window.
      if (terms.length === 0) {
        return { record, hits: 0 };
      }
      const haystack = fold(
        `${record.title}\n${record.profileName}\n${record.category ?? ""}\n${record.fields}\n${record.text}\n${record.fullText}`,
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
    .sort((left, right) => {
      if (right.hits !== left.hits) {
        return right.hits - left.hits;
      }
      const leftDate = left.record.date ?? "";
      const rightDate = right.record.date ?? "";
      return rightDate.localeCompare(leftDate);
    });

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
