/**
 * One-time: set medical_documents.category from title / OCR / filename.
 * Categories: Consultație | Analiză | Investigație
 *
 *   node scripts/categorize-documents.mjs           # dry-run
 *   node scripts/categorize-documents.mjs --apply   # write updates
 *   node scripts/categorize-documents.mjs --sql     # write categorize-updates.sql
 *   node scripts/categorize-documents.mjs --test    # self-check samples
 *   node scripts/categorize-documents.mjs --all     # also overwrite existing categories
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env / .env.local.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  const path = resolve(filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const APPLY = process.argv.includes("--apply");
const SQL_OUT = process.argv.includes("--sql");
const ALL = process.argv.includes("--all");
const SELF_TEST = process.argv.includes("--test");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const CATEGORIES = ["Consultație", "Analiză", "Investigație"];
const DEFAULT_CATEGORY = "Consultație";

function isKnownCategory(value) {
  return CATEGORIES.includes(String(value || "").trim());
}

/**
 * Infer Tip from title, OCR text and filename — same spirit as retitle heuristics.
 * Title / filename win over noisy OCR (reports often mention labs in the body).
 */
function inferCategory({ title, filename, extractedText }) {
  const titleText = (title || "").trim();
  const file = filename || "";
  const text = extractedText || "";

  // 1) Strong title signals (already retitled docs)
  if (/^BULETIN DE ANALIZE/i.test(titleText) || /^Analiz[ăa]\b/i.test(titleText)) {
    return "Analiză";
  }
  if (
    /^(IRM|Radiografie|Ecografie|CT|ECG|Glandele mamare)\b/i.test(titleText) ||
    /^Investiga[țt]ie\b/i.test(titleText)
  ) {
    return "Investigație";
  }
  if (
    /^RAPORT MEDICAL\b/i.test(titleText) ||
    /^Consulta[țt]ie\b/i.test(titleText) ||
    /^Decizie\b/i.test(titleText) ||
    /^Extras\b/i.test(titleText)
  ) {
    return "Consultație";
  }

  // 2) Filename fallbacks
  if (/\blaboratory\b|\blisSonuc\b|analize|buletin/i.test(file)) return "Analiză";
  if (/\binvestigation\b|\birm\b|\brmn\b/i.test(file)) return "Investigație";
  if (/epicriz|epicrisis/i.test(file)) return "Consultație";

  // 3) OCR headers (document type, not body mentions)
  if (
    /BULETIN\s+DE\s+ANALIZE\s+MEDICALE/i.test(text) ||
    /Buletin\s+de\s+Rezultate/i.test(text) ||
    /EXAMENUL\s+SECRETULUI\s+DIN\s+ORGANELE\s+UROGENITALE/i.test(text) ||
    /\bINVITRO\b/i.test(text) ||
    (/Hemoleucograma|Viteza de sedimentare|felcer laborant/i.test(text) &&
      /%|mm\/or|10\^|x\s*10/i.test(text) &&
      !/RAPORT\s+MEDICAL/i.test(text))
  ) {
    return "Analiză";
  }

  if (
    /BULETIN\s+DE\s+INTERPRETARE|\bIRM\b|\bRMN\b|rezonan[tţț][aăâ]\s+magnetic/i.test(
      text,
    ) ||
    /RAPORT\s+RADIOLOGY|RADIOGRAFIA\s+DIGITALA|REGIUNEA\s+INVESTIGATA/i.test(
      text,
    ) ||
    /ECOGRAFIA|BCOGRAFIA|examen\s+cu\s+ultrasunet|sec[tţț]ia\s+de\s+ultrasonografie/i.test(
      text,
    ) ||
    /gl\.?\s*mamare|glandele?\s+mamare/i.test(text) ||
    (/\bAnaliza\s+ecg\b|electrocardiogram/i.test(text) && text.length < 500) ||
    /computer\s+tomograf|tomografie\s+computer/i.test(text)
  ) {
    return "Investigație";
  }

  if (
    /RAPORT\s+MEDICAL/i.test(text) ||
    /CENTRUL\s+OFTALMOLOGIC|PROMED|oftalmo\.md|DECIZIE\s+CONSULTATIVA|ASERTIV/i.test(
      text,
    ) ||
    /EXTRAS\s+DIN\s+FI[SȘŞ]A\s+MEDICAL/i.test(text) ||
    (/Ministerul\s+s[aăâ]n[aăâ]t/i.test(text) &&
      /Documenta[tţț]ie\s+medical|Loc\s+consultatie|CMF\s*nr/i.test(text))
  ) {
    return "Consultație";
  }

  return DEFAULT_CATEGORY;
}

function needsUpdate(current, next) {
  if (!isKnownCategory(current)) return true;
  if (ALL && current !== next) return true;
  return false;
}

if (SELF_TEST) {
  const samples = [
    {
      title: "RAPORT MEDICAL din 28.09.2026",
      filename: "epicrisis_550929213.pdf",
      extractedText: "RAPORT MEDICAL\nPOLICLINICA MEDPARK",
      expect: "Consultație",
    },
    {
      title: "BULETIN DE ANALIZE MEDICALE din 15.07.2026",
      filename: "laboratory_560666007.pdf",
      extractedText: "BULETIN DE ANALIZE MEDICALE",
      expect: "Analiză",
    },
    {
      title: "Glandele mamare",
      filename: "1-PXL_20261020_123758897.jpg",
      extractedText: "SECȚIA DE ULTRASONOGRAFIE\nStructura gl. mamare",
      expect: "Investigație",
    },
    {
      title: "IRM coloană lombară din 04.04.2024",
      filename: "investigation_5570009759.pdf",
      extractedText: "BULETIN DE INTERPRETARE - REZONANȚĂ MAGNETICĂ",
      expect: "Investigație",
    },
    {
      title: "Radiografie cutie toracică din 28.05.2025",
      filename: "PXL_20261020_112734532.jpg",
      extractedText: "RAPORT RADIOLOGY\nREGIUNEA INVESTIGATA CUTIE TORACICA",
      expect: "Investigație",
    },
    {
      title: "Consultație oftalmologică din 20.06.2024",
      filename: "1-PXL_20261020_114910811.jpg",
      extractedText: "CENTRUL OFTALMOLOGIC PROMED",
      expect: "Consultație",
    },
  ];
  let ok = true;
  for (const sample of samples) {
    const got = inferCategory(sample);
    const pass = got === sample.expect;
    if (!pass) ok = false;
    console.log(
      `${sample.filename}\n  → ${got}${pass ? "" : `  (așteptat: ${sample.expect})`}\n`,
    );
  }
  process.exit(ok ? 0 : 1);
}

if (!url || !serviceKey) {
  console.error(`
Lipsește NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.

  node scripts/categorize-documents.mjs
  node scripts/categorize-documents.mjs --apply
  node scripts/categorize-documents.mjs --sql
  node scripts/categorize-documents.mjs --test
`);
  process.exit(1);
}

async function fetchAllDocuments() {
  const rows = [];
  const pageSize = 200;
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const response = await fetch(
      `${url}/rest/v1/medical_documents?select=id,title,category,original_filename,extracted_text,record_id,document_date&record_id=is.null&order=created_at.asc&offset=${from}&limit=${pageSize}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
          Prefer: "count=exact",
          Range: `${from}-${to}`,
        },
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Citire eșuată (${response.status}): ${body.slice(0, 300)}`);
    }
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function updateCategory(id, category) {
  const response = await fetch(
    `${url}/rest/v1/medical_documents?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ category }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Update ${id} eșuat (${response.status}): ${body.slice(0, 200)}`);
  }
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

const documents = await fetchAllDocuments();
const changes = [];

for (const doc of documents) {
  const current = (doc.category || "").trim();
  const next = inferCategory({
    title: doc.title || "",
    filename: doc.original_filename || "",
    extractedText: doc.extracted_text || "",
  });
  if (!needsUpdate(current, next)) continue;
  if (current === next) continue;
  changes.push({
    id: doc.id,
    date: doc.document_date,
    filename: doc.original_filename,
    title: doc.title || "(fără titlu)",
    from: current || "(gol)",
    to: next,
  });
}

const counts = { Consultație: 0, Analiză: 0, Investigație: 0 };
for (const change of changes) counts[change.to] += 1;

console.log(
  `Documente principale: ${documents.length}. Propuneri de categorie: ${changes.length}.`,
);
console.log(
  `  → Consultație ${counts["Consultație"]}, Analiză ${counts["Analiză"]}, Investigație ${counts["Investigație"]}`,
);
console.log("");

for (const change of changes) {
  console.log(`• ${change.date || "fără dată"}  ${change.filename}`);
  console.log(`  ${change.title}`);
  console.log(`  - ${change.from}`);
  console.log(`  + ${change.to}`);
  console.log("");
}

if (SQL_OUT) {
  const statements = changes
    .map(
      (change) =>
        `update public.medical_documents set category = '${sqlEscape(change.to)}' where id = '${change.id}';`,
    )
    .join("\n");
  const outPath = resolve("scripts/categorize-updates.sql");
  writeFileSync(
    outPath,
    `-- Generated by categorize-documents.mjs (${changes.length} updates)\nbegin;\n${statements}\ncommit;\n`,
  );
  console.log(`SQL scris în ${outPath}`);
}

if (APPLY) {
  let done = 0;
  for (const change of changes) {
    await updateCategory(change.id, change.to);
    done += 1;
    console.log(`updated ${done}/${changes.length}: ${change.to}`);
  }
  console.log(`Gata. ${done} categorii actualizate.`);
} else if (!SQL_OUT) {
  console.log("Dry-run. Rulează cu --apply ca să scrii în baza de date, sau --sql.");
}
