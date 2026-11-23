import Link from "next/link";
import { Suspense } from "react";

import { DriveConnectCta } from "@/components/layout/drive-connect-cta";
import { PageFallback } from "@/components/layout/page-fallback";
import { AddProfileButton } from "@/components/profiles/profile-form";
import { RecordRow } from "@/components/records/record-row";
import { Avatar } from "@/components/ui/avatar";
import { loadRecordsIndex } from "@/lib/assistant/catalog";
import { getPageFamilyAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAge, formatBirthDate } from "@/lib/format";
import { expiringInsurances, todayInChisinau } from "@/lib/insurance-status";
import { loadFamilyPeople, type FamilyPerson } from "@/lib/people";
import { loadProfileDocsCard } from "@/lib/profile-docs-card";

export const metadata = {
  title: "Acasă",
};

export const instant = false;

export const maxDuration = 60;

const HOME_LIST_LIMIT = 3;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Familia</h1>
      <Suspense fallback={<PageFallback label="Se încarcă familia…" />}>
        <OverviewSection />
      </Suspense>
    </div>
  );
}

async function OverviewSection() {
  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-base text-destructive">
        {family.error}
      </p>
    );
  }

  const familyId = family.familyId;
  const supabase = await createClient();
  const [peopleResult, index, connection] = await Promise.all([
    loadFamilyPeople(familyId),
    loadRecordsIndex(familyId),
    supabase
      .from("google_drive_connections")
      .select("family_id")
      .eq("family_id", familyId)
      .maybeSingle(),
  ]);

  if (peopleResult.error) {
    return (
      <p role="alert" className="text-base text-destructive">
        {peopleResult.error}
      </p>
    );
  }

  const people = peopleResult.people;
  const isAdmin = family.role === "admin";
  const driveConnected = Boolean(connection.data);

  if (people.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {isAdmin && !driveConnected ? <DriveConnectCta canConnect /> : null}
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
          <p className="text-base text-muted-foreground">
            {isAdmin
              ? "Adaugă prima persoană din familie ca să poți păstra documentele și istoricul medical într-un singur loc."
              : "Nu ai acces la nicio persoană încă. Cere administratorului familiei să îți dea acces."}
          </p>
          {isAdmin ? <AddProfileButton driveConnected={driveConnected} /> : null}
        </div>
      </div>
    );
  }

  const today = todayInChisinau();
  const cards = await Promise.all(
    people.map((person) => loadProfileDocsCard(familyId, person.id)),
  );
  const alerts = people.flatMap((person, position) =>
    expiringInsurances(cards[position].insurances, today).map(
      ({ item, days }) => ({ person, title: item.title, end: item.end_date, days }),
    ),
  );

  // Absent until the health-tracking migration is applied; ignore then.
  const appointmentsResult = await supabase
    .from("appointments")
    .select("id, profile_id, title, starts_at")
    .is("done_at", null)
    .is("cancelled_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(HOME_LIST_LIMIT);
  const nameById = new Map(people.map((person) => [person.id, person.display_name]));
  const appointments = appointmentsResult.error
    ? []
    : ((appointmentsResult.data ?? []) as {
        id: string;
        profile_id: string;
        title: string;
        starts_at: string;
      }[]);

  const records = index.error ? [] : index.records;
  const lastByPerson = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!lastByPerson.has(record.profileId)) {
      lastByPerson.set(record.profileId, record);
    }
  }
  const recent = records.slice(0, HOME_LIST_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && !driveConnected ? <DriveConnectCta canConnect /> : null}

      {alerts.length > 0 ? (
        <section aria-labelledby="alerts-heading" className="flex flex-col gap-2">
          <h2 id="alerts-heading" className="text-base font-semibold">
            De urmărit
          </h2>
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li key={`${alert.person.id}-${alert.title}-${alert.end}`}>
                <Link
                  href={`/profiles/${alert.person.id}`}
                  className="flex min-h-14 flex-col justify-center rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="text-base font-medium">
                    {alert.person.display_name}: asigurarea „{alert.title}”{" "}
                    {alert.days === 0
                      ? "expiră azi"
                      : alert.days === 1
                        ? "expiră mâine"
                        : `expiră în ${alert.days} zile`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Valabilă până la {formatBirthDate(alert.end)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {appointments.length > 0 ? (
        <section
          aria-labelledby="appointments-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="appointments-heading" className="text-base font-semibold">
            Programări
          </h2>
          <ul className="flex flex-col gap-2">
            {appointments.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/profiles/${item.profile_id}`}
                  className="flex min-h-14 flex-col justify-center rounded-xl border bg-card px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="text-base font-medium">
                    {nameById.get(item.profile_id) ?? "Persoană"}: {item.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(item.starts_at).toLocaleString("ro-RO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/Chisinau",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="people-heading" className="flex flex-col gap-2">
        <h2 id="people-heading" className="text-base font-semibold">
          Persoane
        </h2>
        <ul className="flex flex-col gap-3">
          {people.map((person) => (
            <li key={person.id}>
              <PersonCard person={person} last={lastByPerson.get(person.id)} />
            </li>
          ))}
        </ul>
        {isAdmin ? <AddProfileButton driveConnected={driveConnected} /> : null}
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="recent-heading" className="text-base font-semibold">
              Recent
            </h2>
            <Link
              href="/records"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              Tot dosarul
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((record) => (
              <li key={record.id}>
                <RecordRow
                  showPerson
                  record={{
                    id: record.id,
                    title: record.title,
                    date: record.date,
                    category: record.category,
                    snippet: record.snippet,
                    fileCount: record.fileCount,
                    profileName: record.profileName,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PersonCard({
  person,
  last,
}: {
  person: FamilyPerson;
  last?: { title: string; date: string | null };
}) {
  const age = formatAge(person.birth_date);
  return (
    <Link
      href={`/profiles/${person.id}`}
      prefetch
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex items-center gap-3">
        <Avatar name={person.display_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">
            {person.display_name}
          </span>
          <span className="block text-sm text-muted-foreground">
            {age ?? "Data nașterii nesetată"}
          </span>
        </span>
        {person.blood_type ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">
            <span className="sr-only">Grupa de sânge: </span>
            {person.blood_type}
          </span>
        ) : null}
      </span>
      {person.allergies ? (
        <span className="line-clamp-2 text-sm">
          <span className="font-semibold text-warning">Alergii: </span>
          {person.allergies}
        </span>
      ) : null}
      {last ? (
        <span className="line-clamp-1 text-sm text-muted-foreground">
          Ultima înregistrare
          {last.date ? ` (${formatBirthDate(last.date)})` : ""}: {last.title}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          Nicio înregistrare încă.
        </span>
      )}
    </Link>
  );
}
