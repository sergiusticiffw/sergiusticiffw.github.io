import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatReminderTime, reminderFor } from "./reminders.ts";

// Europe/Chisinau is UTC+2 in winter and UTC+3 in summer.
const tomorrowAtNine = "2026-11-21T07:00:00Z";

describe("reminderFor", () => {
  it("returns tomorrow the evening before", () => {
    assert.equal(
      reminderFor(tomorrowAtNine, new Date("2026-11-20T18:00:00Z")),
      "tomorrow",
    );
  });

  it("returns today on the morning of the appointment", () => {
    assert.equal(
      reminderFor(tomorrowAtNine, new Date("2026-11-21T05:00:00Z")),
      "today",
    );
  });

  it("returns null once the appointment has started", () => {
    assert.equal(
      reminderFor(tomorrowAtNine, new Date("2026-11-21T07:00:00Z")),
      null,
    );
    assert.equal(
      reminderFor(tomorrowAtNine, new Date("2026-11-21T07:30:00Z")),
      null,
    );
  });

  it("returns null two days ahead", () => {
    assert.equal(
      reminderFor(tomorrowAtNine, new Date("2026-11-19T18:00:00Z")),
      null,
    );
  });

  it("uses the Chisinau calendar day, not UTC", () => {
    // 22:30Z is already 00:30 on the 21st in Chisinau.
    const now = new Date("2026-11-20T22:30:00Z");
    assert.equal(reminderFor(tomorrowAtNine, now), "today");
    assert.equal(reminderFor("2026-11-21T22:30:00Z", now), "tomorrow");
  });

  it("handles the switch to summer time", () => {
    // Clocks move forward on 2026-03-29; 06:00Z is 09:00 local that day.
    const start = "2026-03-29T06:00:00Z";
    assert.equal(reminderFor(start, new Date("2026-03-28T20:00:00Z")), "tomorrow");
    assert.equal(formatReminderTime(start), "09:00");
  });

  it("returns null for an invalid date", () => {
    assert.equal(reminderFor("not a date", new Date("2026-11-20T18:00:00Z")), null);
  });
});

describe("formatReminderTime", () => {
  it("formats the start in Chisinau time", () => {
    assert.equal(formatReminderTime(tomorrowAtNine), "09:00");
  });
});
