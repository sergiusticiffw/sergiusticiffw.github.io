import Link from "next/link";
import { CalendarClock } from "lucide-react";

import {
  loadUpcomingAppointments,
  type UpcomingAppointment,
} from "@/lib/appointments-upcoming";
import { getPageFamilyAccess } from "@/lib/auth";
import { loadFamilyPeople } from "@/lib/people";
import {
  formatReminderTime,
  reminderFor,
  type Reminder,
} from "@/lib/reminders";

export async function AppointmentReminders() {
  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return null;
  }

  const now = new Date();
  const [appointments, { people }] = await Promise.all([
    loadUpcomingAppointments(now),
    loadFamilyPeople(family.familyId),
  ]);

  const nameById = new Map(people.map((person) => [person.id, person.display_name]));
  const reminders = appointments
    .map((item) => ({ item, when: reminderFor(item.starts_at, now) }))
    .filter(
      (entry): entry is { item: UpcomingAppointment; when: Reminder } =>
        entry.when !== null,
    )
    .sort((left, right) =>
      left.when === right.when
        ? left.item.starts_at.localeCompare(right.item.starts_at)
        : left.when === "today"
          ? -1
          : 1,
    );

  if (reminders.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-warning/40 bg-warning-soft"
    >
      <ul className="mx-auto flex w-full max-w-3xl flex-col px-4 py-1 text-sm">
        {reminders.map(({ item, when }) => (
          <li key={item.id}>
            <Link
              href={`/profiles/${item.profile_id}`}
              className="flex min-h-11 items-center gap-2 rounded-md font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <CalendarClock className="size-4 shrink-0" aria-hidden />
              <span>
                {when === "today" ? "Azi" : "Mâine"} la{" "}
                {formatReminderTime(item.starts_at)}: {item.title},{" "}
                {nameById.get(item.profile_id) ?? "Persoană"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
