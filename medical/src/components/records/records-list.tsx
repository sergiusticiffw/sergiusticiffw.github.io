"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBirthDate } from "@/lib/format";

export type RecordListItem = {
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  title: string;
  snippet: string;
  search: string;
  fileCount: number;
};

export type RecordPerson = {
  id: string;
  display_name: string;
};

function fold(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const PAGE_SIZE = 10;

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function RecordsList({
  records = [],
  people = [],
}: {
  records?: RecordListItem[];
  people?: RecordPerson[];
}) {
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const peopleOptions = useMemo(() => {
    const map = new Map<string, RecordPerson>();
    for (const person of people) {
      if (person.id) {
        map.set(person.id, person);
      }
    }
    for (const record of records) {
      if (record.profileId && !map.has(record.profileId)) {
        map.set(record.profileId, {
          id: record.profileId,
          display_name: record.profileName,
        });
      }
    }
    return [...map.values()].sort((left, right) =>
      left.display_name.localeCompare(right.display_name, "ro"),
    );
  }, [people, records]);

  const matched = useMemo(() => {
    const needle = fold(query.trim());
    const selected = peopleOptions.find((person) => person.id === personId);
    const selectedName = selected ? fold(selected.display_name) : "";
    return records.filter((record) => {
      if (personId) {
        const sameId = record.profileId === personId;
        const sameName = selectedName.length > 0 && fold(record.profileName) === selectedName;
        if (!sameId && !sameName) {
          return false;
        }
      }
      if (month && (!record.date || !record.date.startsWith(month))) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (record.search || fold(`${record.title} ${record.profileName} ${record.snippet}`)).includes(
        needle,
      );
    });
  }, [records, query, personId, month, peopleOptions]);

  const filtered = Boolean(query.trim() || personId || month);
  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = matched.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [query, personId, month]);

  function clearFilters() {
    setQuery("");
    setPersonId("");
    setMonth("");
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="records-search">Caută</Label>
          <Input
            id="records-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Titlu, persoană sau text…"
            className="h-11"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="records-person">Persoană</Label>
            <select
              id="records-person"
              value={personId}
              className={selectClass}
              onChange={(event) => setPersonId(event.target.value)}
            >
              <option value="">Toate persoanele</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="records-month">Lună</Label>
            <Input
              id="records-month"
              type="month"
              value={month}
              className="h-11"
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {matched.length === records.length
            ? `${records.length} înregistrări`
            : `${matched.length} din ${records.length} înregistrări`}
        </p>
        {filtered ? (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={clearFilters}
          >
            Șterge filtrele
          </Button>
        ) : null}
      </div>
      {matched.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nicio înregistrare pentru aceste filtre.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((record) => (
            <li key={record.id}>
              <Link
                href={`/records/${record.id}`}
                prefetch
                className="block rounded-lg border px-3 py-3 hover:bg-muted/50"
              >
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {record.date ? formatBirthDate(record.date) : "Fără dată"}
                  </span>
                  {` · ${record.profileName}`}
                </p>
                <p className="mt-0.5 text-sm font-medium">{record.title}</p>
                {record.snippet ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {record.snippet}
                  </p>
                ) : null}
                {record.fileCount > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {record.fileCount === 1
                      ? "1 fișier"
                      : `${record.fileCount} fișiere`}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {current + 1} din {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Înapoi
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Înainte
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
