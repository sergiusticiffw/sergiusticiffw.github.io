/** Today as YYYY-MM-DD in the family's time zone (the server runs in UTC). */
export function todayInChisinau(now: Date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Chisinau",
  }).format(now);
}

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function daysBetween(from: string, to: string) {
  return dayNumber(to) - dayNumber(from);
}

export type InsuranceDates = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
};

/** Active policies that end within `withinDays`, soonest first. */
export function expiringInsurances<T extends InsuranceDates>(
  insurances: T[],
  today: string,
  withinDays = 30,
) {
  return insurances
    .filter((item) => item.start_date <= today && item.end_date >= today)
    .map((item) => ({ item, days: daysBetween(today, item.end_date) }))
    .filter(({ days }) => days >= 0 && days <= withinDays)
    .sort((left, right) => left.days - right.days);
}
