import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMedicalDigest } from "./medical-digest.ts";

const header = [
  "CLINICA EXAMPLE SRL",
  "Tel. 022 123 456",
  "www.example.md",
  "Str. Exemplu 1, Chișinău",
  "CLINICA EXAMPLE SRL",
  "Tel. 022 123 456",
  "www.example.md",
  "CLINICA EXAMPLE SRL",
  "Tel. 022 123 456",
].join("\n");

const body = [
  "Pacient: SERGIU STICI",
  "Data: 03.11.2026",
  "",
  "Hemoglobină 13.2 g/dl (12-16)",
  "Glicemie 5.4 mmol/l",
  "",
  "Concluzie: valori în limitele referinței.",
  "Recomandări: control peste 6 luni, hidratare adecvată.",
  "Tratament: nu este necesar.",
].join("\n");

describe("buildMedicalDigest", () => {
  it("prefers conclusions over repeated letterhead", () => {
    const raw = `${header}\n\n${"Lorem ipsum ".repeat(200)}\n\n${body}`;
    const digest = buildMedicalDigest(raw, 900);
    assert.match(digest, /concluzie/i);
    assert.match(digest, /recomand/i);
    assert.match(digest, /hemoglobin/i);
    assert.doesNotMatch(digest, /www\.example\.md/i);
    assert.ok(digest.length <= 900);
  });

  it("falls back to the document tail when content is sparse", () => {
    const raw = `${"x".repeat(5000)}FINAL_CONCLUZIE_IMPORTANTĂ`;
    const digest = buildMedicalDigest(raw, 200);
    assert.match(digest, /FINAL_CONCLUZIE/);
  });

  it("keeps short useful documents intact", () => {
    const digest = buildMedicalDigest(body, 2000);
    assert.match(digest, /Glicemie/);
    assert.match(digest, /Recomandări/);
  });
});
