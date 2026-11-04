/** Pure assistant query helpers (no server-only — safe for unit tests). */

export function fold(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export const MONTHS: Record<string, number> = {
  ianuarie: 1,
  ian: 1,
  februarie: 2,
  feb: 2,
  martie: 3,
  mar: 3,
  aprilie: 4,
  apr: 4,
  mai: 5,
  iunie: 6,
  iun: 6,
  iulie: 7,
  iul: 7,
  august: 8,
  aug: 8,
  septembrie: 9,
  sept: 9,
  sep: 9,
  octombrie: 10,
  oct: 10,
  noiembrie: 11,
  nov: 11,
  decembrie: 12,
  dec: 12,
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Detect Romanian month/year phrases and map them to YYYY-MM-DD bounds. */
export function parsePeriodHints(query: string): { from?: string; to?: string } {
  const folded = fold(query);
  const yearMatch = folded.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const isoMonth = folded.match(/\b(20\d{2})[-/.](\d{1,2})\b/);
  if (isoMonth) {
    const y = Number(isoMonth[1]);
    const month = Number(isoMonth[2]);
    if (month >= 1 && month <= 12) {
      return {
        from: isoDate(y, month, 1),
        to: isoDate(y, month, daysInMonth(y, month)),
      };
    }
  }

  const slashMonth = folded.match(/\b(\d{1,2})[-/.](20\d{2})\b/);
  if (slashMonth) {
    const month = Number(slashMonth[1]);
    const y = Number(slashMonth[2]);
    if (month >= 1 && month <= 12) {
      return {
        from: isoDate(y, month, 1),
        to: isoDate(y, month, daysInMonth(y, month)),
      };
    }
  }

  for (const [name, month] of Object.entries(MONTHS)) {
    if (!new RegExp(`(?:^|[^\\p{L}])${name}(?:[^\\p{L}]|$)`, "u").test(folded)) {
      continue;
    }
    if (name.length <= 3 && year == null) {
      continue;
    }
    const y = year ?? new Date().getFullYear();
    return {
      from: isoDate(y, month, 1),
      to: isoDate(y, month, daysInMonth(y, month)),
    };
  }

  if (year) {
    return { from: isoDate(year, 1, 1), to: isoDate(year, 12, 31) };
  }

  return {};
}

export type ProfileRef = { id: string; display_name: string };

/**
 * Resolve a person name from the question.
 * Returns ambiguous candidates when several profiles match equally well.
 */
export function resolveProfiles(
  people: ProfileRef[],
  query: string,
): {
  match?: ProfileRef;
  ambiguous?: ProfileRef[];
  none?: true;
} {
  const q = fold(query).trim();
  if (!q) {
    return {};
  }

  const scored = people
    .map((person) => {
      const name = fold(person.display_name);
      let score = 0;
      if (name === q) {
        score = 100;
      } else if (name.includes(q) || q.includes(name)) {
        score = 70;
      } else {
        const qParts = q.split(/\s+/).filter((part) => part.length >= 2);
        const nParts = name.split(/\s+/).filter((part) => part.length >= 2);
        const hits = qParts.filter((term) =>
          nParts.some((part) => part.includes(term) || term.includes(part)),
        ).length;
        score = hits * 25;
      }
      return { person, score };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return { none: true };
  }

  const top = scored[0]!;
  const tied = scored.filter((row) => row.score === top.score);
  if (tied.length > 1) {
    return { ambiguous: tied.map((row) => row.person) };
  }

  const second = scored[1];
  if (second && top.score < 100 && top.score - second.score < 25) {
    return {
      ambiguous: scored.slice(0, 4).map((row) => row.person),
    };
  }

  return { match: top.person };
}

/** Normalize category hints like „analize”, „consultații”. */
export function matchesCategory(
  category: string | null | undefined,
  title: string | null | undefined,
  wanted: string,
) {
  const needle = fold(wanted).trim();
  if (!needle) {
    return true;
  }
  const haystack = fold(`${category ?? ""} ${title ?? ""}`);
  if (needle.includes("analiz")) {
    return haystack.includes("analiz");
  }
  if (needle.includes("consulta")) {
    return haystack.includes("consulta");
  }
  if (needle.includes("investiga")) {
    return haystack.includes("investiga");
  }
  if (needle.includes("urg")) {
    return haystack.includes("urg");
  }
  return haystack.includes(needle);
}
