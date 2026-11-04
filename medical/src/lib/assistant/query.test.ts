import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchesCategory,
  parsePeriodHints,
  resolveProfiles,
} from "./query.ts";

describe("parsePeriodHints", () => {
  it("maps Romanian month + year to ISO bounds", () => {
    assert.deepEqual(parsePeriodHints("ce rapoarte am in octombrie 2024"), {
      from: "2024-10-01",
      to: "2024-10-31",
    });
  });

  it("maps year-only to full year", () => {
    assert.deepEqual(parsePeriodHints("documente din 2023"), {
      from: "2023-01-01",
      to: "2023-12-31",
    });
  });

  it("maps numeric month/year", () => {
    assert.deepEqual(parsePeriodHints("analize 03/2025"), {
      from: "2025-03-01",
      to: "2025-03-31",
    });
  });

  it("ignores short month aliases without year", () => {
    assert.deepEqual(parsePeriodHints("ce mai am"), {});
  });
});

describe("resolveProfiles", () => {
  const people = [
    { id: "1", display_name: "Ana Pop" },
    { id: "2", display_name: "Ana Maria Pop" },
    { id: "3", display_name: "Ion Pop" },
  ];

  it("matches a unique full name", () => {
    const result = resolveProfiles(people, "Ion Pop");
    assert.equal(result.match?.id, "3");
    assert.equal(result.ambiguous, undefined);
  });

  it("flags ambiguous short names", () => {
    const result = resolveProfiles(people, "Ana");
    assert.ok(result.ambiguous);
    assert.ok((result.ambiguous?.length ?? 0) >= 2);
  });

  it("returns none for unknown names", () => {
    const result = resolveProfiles(people, "Mihai");
    assert.equal(result.none, true);
  });
});

describe("matchesCategory", () => {
  it("matches analyses", () => {
    assert.equal(matchesCategory("Analiză", "Buletin", "analize"), true);
    assert.equal(matchesCategory("Consultație", "Control", "analize"), false);
  });

  it("matches consultations", () => {
    assert.equal(matchesCategory("Consultație", "Control", "consultații"), true);
  });
});
