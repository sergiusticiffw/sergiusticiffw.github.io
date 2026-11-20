export function formatBirthDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Romanian cardinal + noun: "1 an", "2 ani", "20 de ani". */
function countNoun(count: number, one: string, many: string) {
  if (count === 1) {
    return `1 ${one}`;
  }
  const rest = count % 100;
  const needsDe = count !== 0 && (rest === 0 || rest >= 20);
  return `${count}${needsDe ? " de" : ""} ${many}`;
}

/**
 * Human age for a date-only birth date, e.g. "8 luni", "2 ani și 4 luni",
 * "34 de ani". Returns null for missing, invalid or future dates.
 */
export function formatAge(birthDate: string | null, now: Date = new Date()) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return null;
  }
  const [year, month, day] = birthDate.split("-").map(Number);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(born.getTime())) {
    return null;
  }
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  if (born.getTime() > today.getTime()) {
    return null;
  }

  let months =
    (today.getUTCFullYear() - born.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - born.getUTCMonth());
  if (today.getUTCDate() < born.getUTCDate()) {
    months -= 1;
  }

  if (months < 1) {
    const days = Math.floor(
      (today.getTime() - born.getTime()) / 86_400_000,
    );
    return countNoun(days, "zi", "zile");
  }
  if (months < 24) {
    return countNoun(months, "lună", "luni");
  }
  const years = Math.floor(months / 12);
  if (years < 6) {
    const restMonths = months % 12;
    return restMonths > 0
      ? `${countNoun(years, "an", "ani")} și ${countNoun(restMonths, "lună", "luni")}`
      : countNoun(years, "an", "ani");
  }
  return countNoun(years, "an", "ani");
}

/** Hides all but the last digits of a personal ID number. */
export function maskIdnp(idnp: string | null) {
  if (!idnp) {
    return null;
  }
  return idnp.length > 4 ? `•••••••••${idnp.slice(-4)}` : idnp;
}

export function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("ro"));
  return letters.join("") || "?";
}

export function formatDateTime(value: string | Date | number | null | undefined) {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ro-RO").format(value);
}

export function formatDurationUntil(until: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((until - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) {
    return `${hours} h ${minutes} min`;
  }
  if (hours) {
    return `${hours} h`;
  }
  if (minutes) {
    return `${minutes} min`;
  }
  return `${seconds} s`;
}
