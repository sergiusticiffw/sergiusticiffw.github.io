import { daysBetween, todayInChisinau } from "./insurance-status.ts";

export type Reminder = "tomorrow" | "today";

/**
 * "tomorrow" when the appointment falls on the next calendar day in
 * Europe/Chisinau, "today" when it is later today, null otherwise.
 */
export function reminderFor(
  startsAt: string | Date,
  now: Date = new Date(),
): Reminder | null {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) {
    return null;
  }

  const days = daysBetween(todayInChisinau(now), todayInChisinau(start));
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "tomorrow";
  }
  return null;
}

/** Start time as HH:mm in the family's time zone. */
export function formatReminderTime(startsAt: string | Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Chisinau",
  }).format(startsAt instanceof Date ? startsAt : new Date(startsAt));
}
