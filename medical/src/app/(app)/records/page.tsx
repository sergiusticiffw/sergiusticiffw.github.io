import { Suspense } from "react";
import Link from "next/link";

import { DeleteRecordButton } from "@/components/profiles/delete-record-button";
import { DocumentPreview } from "@/components/profiles/document-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminFamilyId } from "@/lib/auth";
import { formatBirthDate } from "@/lib/format";
import { documentBody } from "@/lib/record-view";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_CATEGORIES } from "@/lib/validation/document";

export const metadata = {
  title: "Înregistrări",
};

type Filters = {
  q?: string;
  profile?: string;
  category?: string;
  from?: string;
  to?: string;
};

type Row = {
  id: string;
  kind: "document" | "consultation" | "lab";
  profileName: string;
  date: string | null;
  title: string;
  body: string;
  documentId: string | null;
  files: { id: string; filename: string; mimeType: string | null }[];
};

function cleanDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : "";
}

function inRange(day: string | null, from: string, to: string) {
  if (!from && !to) {
    return true;
  }
  if (!day) {
    return false;
  }
  if (from && day < from) {
    return false;
  }
  if (to && day > to) {
    return false;
  }
  return true;
}

function matchesText(values: Array<string | null>, query: string) {
  if (!query) {
    return true;
  }
  const needle = query.toLocaleLowerCase("ro");
  return values.some((value) => value?.toLocaleLowerCase("ro").includes(needle));
}

export default function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Înregistrări</h1>
        <p className="text-sm text-muted-foreground">
          Fiecare document este o înregistrare: data, textul citit și fișierul.
          Poți căuta după persoană, categorie și dată.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Se încarcă înregistrările…</p>
        }
      >
        <RecordsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RecordsSection({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams;
  const query = (filters.q ?? "").trim().slice(0, 120);
  const category = DOCUMENT_CATEGORIES.some((item) => item === filters.category)
    ? filters.category ?? ""
    : "";
  const profileId = /^[0-9a-f-]{36}$/i.test(filters.profile ?? "")
    ? filters.profile ?? ""
    : "";
  const from = cleanDate(filters.from);
  const to = cleanDate(filters.to);
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const supabase = await createClient();
  const [profilesResult, documentsResult, consultationsResult, labsResult] =
    await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("family_id", family.familyId)
      .order("display_name", { ascending: true }),
    supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, mime_type, document_date, category, extracted_text, record_id",
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
  if (documentsError?.code === "42703" || documentsError?.code === "PGRST204") {
    const retry = await supabase
      .from("medical_documents")
      .select(
        "id, profile_id, original_filename, mime_type, document_date, category, extracted_text",
      )
      .order("document_date", { ascending: false });
    documentsError = retry.error;
    documentsData = (retry.data ?? []).map((row) => ({
      ...row,
      record_id: null,
    }));
  }

  const listError =
    profilesResult.error ??
    documentsError ??
    consultationsResult.error ??
    labsResult.error;
  if (listError) {
    console.error("listRecords", listError.code);
    return (
      <p role="alert" className="text-sm text-destructive">
        Înregistrările nu au putut fi încărcate.
      </p>
    );
  }

  const profiles = (profilesResult.data ?? []) as {
    id: string;
    display_name: string;
  }[];
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  const profileIds = new Set(profiles.map((profile) => profile.id));
  const consultations = ((consultationsResult.data ?? []) as {
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
  const labs = ((labsResult.data ?? []) as {
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
    mime_type: string | null;
    document_date: string | null;
    category: string | null;
    extracted_text: string | null;
    record_id: string | null;
  }[]).filter((item) => profileIds.has(item.profile_id));

  const primaries = documents.filter((item) => !item.record_id);
  const documentRows = primaries
    .filter((item) => !profileId || item.profile_id === profileId)
    .filter((item) => !category || item.category === category)
    .filter((item) => inRange(item.document_date, from, to))
    .map((item) => {
      const files = [
        item,
        ...documents.filter((file) => file.record_id === item.id),
      ];
      const body = documentBody({
        extractedText: item.extracted_text,
        consultation:
          consultations.find((row) => row.source_document_id === item.id) ?? null,
        labs: labs.filter((row) => row.source_document_id === item.id),
      });
      return {
        item,
        body,
        filenames: files.map((file) => file.original_filename),
        row: {
          id: item.id,
          kind: "document" as const,
          profileName: names.get(item.profile_id) ?? "Profil",
          date: item.document_date,
          title: [
            item.category,
            files.length > 1 ? `${files.length} fișiere` : item.original_filename,
          ]
            .filter(Boolean)
            .join(" · "),
          body,
          documentId: item.id,
          files: files.map((file) => ({
            id: file.id,
            filename: file.original_filename,
            mimeType: file.mime_type,
          })),
        } satisfies Row,
      };
    })
    .filter((entry) =>
      matchesText(
        [entry.row.title, entry.body, entry.item.category, ...entry.filenames],
        query,
      ),
    )
    .map((entry) => entry.row);

  const manualRows = category
    ? []
    : [
        ...consultations
          .filter((item) => !item.source_document_id)
          .filter((item) => !profileId || item.profile_id === profileId)
          .filter((item) => inRange(item.consultation_date, from, to))
          .map((item) => {
            const body = documentBody({
              extractedText: null,
              consultation: item,
              labs: [],
            });
            return {
              id: item.id,
              kind: "consultation" as const,
              profileName: names.get(item.profile_id) ?? "Profil",
              date: item.consultation_date,
              title: ["Consultație", item.doctor_name].filter(Boolean).join(" · "),
              body,
              documentId: null,
              files: [],
            };
          }),
        ...labs
          .filter((item) => !item.source_document_id)
          .filter((item) => !profileId || item.profile_id === profileId)
          .filter((item) => inRange(item.sample_date, from, to))
          .map((item) => {
            const body = documentBody({
              extractedText: null,
              consultation: null,
              labs: [item],
            });
            return {
              id: item.id,
              kind: "lab" as const,
              profileName: names.get(item.profile_id) ?? "Profil",
              date: item.sample_date,
              title: ["Analiză", item.test_name].filter(Boolean).join(" · "),
              body,
              documentId: null,
              files: [],
            };
          }),
      ].filter((item) => matchesText([item.title, item.body], query));

  const rows: Row[] = [...documentRows, ...manualRows].sort((left, right) => {
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
  const hasFilters = Boolean(query || profileId || category || from || to);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="q">Căutare</Label>
          <Input
            id="q"
            name="q"
            defaultValue={query}
            className="h-11"
            placeholder="Medic, clinică, analiză, rezultat"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile">Persoană</Label>
          <select
            id="profile"
            name="profile"
            defaultValue={profileId}
            className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Toate</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Categorie</Label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Toate</option>
            {DOCUMENT_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">De la</Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">Până la</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="h-11" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
          <Button type="submit" className="h-11">
            Filtrează
          </Button>
          {hasFilters ? (
            <Link
              href="/records"
              className="inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm"
            >
              Resetează
            </Link>
          ) : null}
        </div>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nicio înregistrare pentru filtrele alese.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                {[row.profileName, formatBirthDate(row.date)].filter(Boolean).join(" · ")}
              </p>
              <p className="text-sm font-medium">{row.title || "Înregistrare"}</p>
              {row.body ? (
                <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm">
                  {row.body}
                </p>
              ) : null}
              {row.files.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {row.files.map((file) => (
                    <li key={file.id}>
                      <DocumentPreview
                        id={file.id}
                        filename={file.filename}
                        mimeType={file.mimeType}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <DeleteRecordButton
                kind={row.kind}
                id={row.id}
                withFiles={row.files.length > 0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
