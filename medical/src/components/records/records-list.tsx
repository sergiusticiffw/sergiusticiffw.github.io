"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RecordRow } from "@/components/records/record-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  parseRecordCategory,
  RECORD_CATEGORIES,
  type RecordCategory,
} from "@/lib/record-category";
import { foldText, groupByMonth } from "@/lib/timeline";

export type RecordListItem = {
  id: string;
  profileId: string;
  profileName: string;
  date: string | null;
  title: string;
  category?: string | null;
  snippet: string;
  search: string;
  fileCount: number;
};

export type RecordPerson = {
  id: string;
  display_name: string;
};

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type FilterKey = "q" | "person" | "type" | "month" | "page";

function parseCategory(value: string | null): "" | RecordCategory {
  return (RECORD_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as RecordCategory)
    : "";
}

/**
 * Searchable, filterable history. Filters and the page live in the URL so the
 * back button returns to the same view and a filtered view can be bookmarked.
 */
export function RecordsList({
  records = [],
  people = [],
}: {
  records?: RecordListItem[];
  people?: RecordPerson[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const personId = searchParams.get("person") ?? "";
  const category = parseCategory(searchParams.get("type"));
  const month = /^\d{4}-\d{2}$/.test(searchParams.get("month") ?? "")
    ? (searchParams.get("month") as string)
    : "";
  const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1) - 1;

  const [query, setQuery] = useState(urlQuery);
  const pushedQuery = useRef(urlQuery);

  const update = useCallback(
    (changes: Partial<Record<FilterKey, string>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      const text = next.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Typing updates the URL after a short pause instead of on every key.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === pushedQuery.current) {
      return;
    }
    const timer = setTimeout(() => {
      pushedQuery.current = trimmed;
      update({ q: trimmed, page: "" });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, update]);

  // Back/forward navigation changes the URL; mirror it into the input.
  useEffect(() => {
    if (urlQuery !== pushedQuery.current) {
      pushedQuery.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);

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
    const needle = foldText(urlQuery.trim());
    return records.filter((record) => {
      if (personId && record.profileId !== personId) {
        return false;
      }
      if (category && parseRecordCategory(record.category) !== category) {
        return false;
      }
      if (month && (!record.date || !record.date.startsWith(month))) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        record.search ||
        foldText(`${record.title} ${record.profileName} ${record.snippet}`)
      ).includes(needle);
    });
  }, [records, urlQuery, personId, category, month]);

  const filtered = Boolean(urlQuery.trim() || personId || category || month);
  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const current = Math.min(requestedPage, pageCount - 1);
  const visible = matched.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );
  const groups = groupByMonth(visible);

  function clearFilters() {
    setQuery("");
    pushedQuery.current = "";
    router.replace(pathname, { scroll: false });
  }

  function goToPage(index: number) {
    update({ page: index === 0 ? "" : String(index + 1) });
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="records-search">Caută</Label>
          <Input
            id="records-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Doctor, analiză, diagnostic, text…"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="records-person">Persoană</Label>
            <Select
              id="records-person"
              value={personId}
              onChange={(event) =>
                update({ person: event.target.value, page: "" })
              }
            >
              <option value="">Toate persoanele</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="records-category">Tip</Label>
            <Select
              id="records-category"
              value={category}
              onChange={(event) =>
                update({ type: event.target.value, page: "" })
              }
            >
              <option value="">Toate tipurile</option>
              {RECORD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="records-month">Lună</Label>
            <Input
              id="records-month"
              type="month"
              value={month}
              onChange={(event) =>
                update({ month: event.target.value, page: "" })
              }
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          {matched.length === records.length
            ? `${records.length} înregistrări`
            : `${matched.length} din ${records.length} înregistrări`}
        </p>
        {filtered ? (
          <Button type="button" variant="outline" onClick={clearFilters}>
            Șterge filtrele
          </Button>
        ) : null}
      </div>
      {matched.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed px-4 py-6">
          {records.length === 0 ? (
            <>
              <p className="text-base text-muted-foreground">
                Nicio înregistrare încă. Deschide o persoană și încarcă un
                document sau adaugă o notă.
              </p>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center text-base font-medium underline underline-offset-4"
              >
                Mergi la Acasă
              </Link>
            </>
          ) : (
            <>
              <p className="text-base text-muted-foreground">
                Nicio înregistrare pentru aceste filtre.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={clearFilters}
              >
                Șterge filtrele
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`month-${group.key}`}
              className="flex flex-col gap-2"
            >
              <h2
                id={`month-${group.key}`}
                className="text-sm font-semibold text-muted-foreground"
              >
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((record) => (
                  <li key={record.id}>
                    <RecordRow
                      showPerson
                      record={{
                        id: record.id,
                        title: record.title,
                        date: record.date,
                        category: parseRecordCategory(record.category),
                        snippet: record.snippet,
                        fileCount: record.fileCount,
                        profileName: record.profileName,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {pageCount > 1 ? (
        <nav
          aria-label="Pagini de înregistrări"
          className="flex items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {current + 1} din {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={current === 0}
              onClick={() => goToPage(current - 1)}
            >
              Înapoi
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={current >= pageCount - 1}
              onClick={() => goToPage(current + 1)}
            >
              Înainte
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
