/**
 * One-time: derive human-readable titles from extracted_text / filename.
 *
 *   node scripts/retitle-documents.mjs              # dry-run (preview)
 *   node scripts/retitle-documents.mjs --apply      # write updates
 *   node scripts/retitle-documents.mjs --sql        # print UPDATE statements
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env / .env.local (Dashboard → Settings → API).
 * Remove the key after running. Do not commit it.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  const path = resolve(filename);
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const APPLY = process.argv.includes("--apply");
const SQL_OUT = process.argv.includes("--sql");
const ALL = process.argv.includes("--all"); // also retitle titles that already look fine
const SELF_TEST = process.argv.includes("--test");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const MAX_TITLE = 120;

function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return "";
  }
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function dateFromText(text) {
  const patterns = [
    /Data\s+de\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /Data\s+examin[aă]rii\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /Data\s+internarii\s+(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /Data\s+recolt[aă]rii[^0-9]{0,40}(\d{1,2}[./]\d{1,2}[./]\d{4})/i,
    /(\d{1,2}[./]\d{1,2}[./]\d{4})\s+\d{1,2}:\d{2}/,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (!match) continue;
    const [d, m, y] = match[1].replace(/\//g, ".").split(".");
    return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
  }
  return "";
}

function withDate(heading, isoDate, text) {
  if (!heading) return "";
  // Short anatomical labels stay bare (ex: "Glandele mamare")
  if (/^Glandele mamare$/i.test(heading)) return heading;
  const d = formatDate(isoDate) || dateFromText(text);
  return d ? `${heading} din ${d}` : heading;
}

/**
 * Real document title from OCR/PDF text.
 * Priority: formal headers → exam region → specialty → filename.
 * Never include IDNP, person names, addresses, clinic slogans.
 */
function extractHeading(filename, text) {
  const file = filename || "";
  const t = text || "";

  // --- 1. Formal document headers (highest priority) ---
  if (/BULETIN\s+DE\s+ANALIZE\s+MEDICALE/i.test(t)) {
    return "BULETIN DE ANALIZE MEDICALE";
  }
  if (/Buletin\s+de\s+Rezultate|EXAMENUL\s+SECRETULUI\s+DIN\s+ORGANELE\s+UROGENITALE/i.test(t)) {
    return "BULETIN DE ANALIZE MEDICALE";
  }
  if (/RAPORT\s+MEDICAL/i.test(t)) {
    return "RAPORT MEDICAL";
  }
  if (/EXTRAS\s+DIN\s+FI[SȘ]A\s+MEDICALA|Extras\s+din\s+fi[sș]a\s+medical/i.test(t)) {
    return "Extras din fișa medicală";
  }
  if (/DECIZIE\s+CONSULTATIVA|ASERTIV.*DEZVOLTARE\s+PSIHOEMOTIONALA/i.test(t)) {
    return "Decizie consultativă";
  }
  if (/BILET\s+DE\s+TRIMITERE/i.test(t)) {
    return "BILET DE TRIMITERE";
  }
  if (/ADEVERIN[TȚ][AĂ]\s+MEDICAL[AĂ]/i.test(t)) {
    return "ADEVERINȚĂ MEDICALĂ";
  }
  if (/CONCEDIU\s+MEDICAL/i.test(t)) {
    return "CONCEDIU MEDICAL";
  }
  if (/BULETIN\s+DE\s+INTERPRETARE\s*[-–]?\s*REZONAN/i.test(t)) {
    if (/cervical/i.test(t)) return "IRM coloană cervicală";
    if (/lombar/i.test(t)) return "IRM coloană lombară";
    if (/cerebral|creier|cranian/i.test(t)) return "IRM cerebral";
    if (/genunchi/i.test(t)) return "IRM genunchi";
    if (/um[aă]r/i.test(t)) return "IRM umăr";
    return "IRM";
  }

  // --- 2. Exam / region (when no formal clinical report header) ---
  if (/gl\.?\s*mamare|glandele?\s+mamare|ecografia?\s+glandelor\s+mamare/i.test(t)) {
    return "Glandele mamare";
  }
  if (/ECOGRAFIA|BCOGRAFIA|examen\s+cu\s+ultrasunet|sec[tţț]ia\s+de\s+ultrasonografie/i.test(t)) {
    if (/ARTICULA[TŢȚ]?I[AO]\s+GENUNCHI|genunchi/i.test(t)) return "Ecografie genunchi";
    if (/PROSTATEI|prostat/i.test(t)) return "Ecografie prostată";
    if (/sistemul(?:ui)?\s+urinar|aparat(?:ul)?\s+urinar/i.test(t) && /abdomin/i.test(t)) {
      return "Ecografie abdomen și aparat urinar";
    }
    if (/sistemul(?:ui)?\s+urinar|aparat(?:ul)?\s+urinar/i.test(t)) return "Ecografie aparat urinar";
    if (/organelor\s+abdominale/i.test(t)) return "Ecografie abdomen";
    if (/tiroid/i.test(t)) return "Ecografie tiroidă";
    return "Ecografie";
  }
  if (/organelor\s+abdominale[\s\S]{0,80}sistemul\s+urinar|sistemul\s+urinar[\s\S]{0,80}abdominale/i.test(t)) {
    return "Ecografie abdomen și aparat urinar";
  }
  if (/REGIUNEA\s+INVESTIGATA[^.\n]{0,60}CUTI[EA]\s+TORACICA/i.test(t)) {
    return "Radiografie cutie toracică";
  }
  if (/REGIUNEA\s+INVESTIGATA[^.\n]{0,40}PLANTA/i.test(t)) {
    return "Radiografie plantară";
  }
  if (/RAPORT\s+RADIOLOGY|RADIOGRAFIA\s+DIGITALA/i.test(t)) {
    return "Radiografie";
  }
  if (/\bIRM\b|\bRMN\b|rezonan[tț][aă]\s+magnetic/i.test(t)) {
    if (/cervical/i.test(t)) return "IRM coloană cervicală";
    if (/lombar/i.test(t)) return "IRM coloană lombară";
    if (/cerebral|creier|cranian/i.test(t)) return "IRM cerebral";
    if (/genunchi/i.test(t)) return "IRM genunchi";
    if (/um[aă]r/i.test(t)) return "IRM umăr";
    return "IRM";
  }
  if (/computer\s+tomograf|tomografie\s+computer/i.test(t)) {
    return "CT";
  }

  // --- 3. Specialty / ambulatory (no RAPORT MEDICAL in text) ---
  if (/CENTRUL\s+OFTALMOLOGIC|consulta[tț]ia\s+oftalmologului|Visus\s*\(|oftalmo\.md|PROMED/i.test(t)) {
    return "Consultație oftalmologică";
  }
  if (/\bAnaliza\s+ecg\b|electrocardiogram|\bECG\b/i.test(t) && t.length < 400) {
    return "ECG";
  }
  if (/^Receta$/i.test(t.trim()) || (/\bRe[tț]et[aă]\b/i.test(t) && t.length < 80)) {
    return "Rețetă";
  }
  if (
    /Ministerul\s+s[aăâ]n[aăâ]t/i.test(t) &&
    (/Loc\s+consultatie|Num[aăâ]r\s+consult|Documenta[tţț]ie\s+medical[aăâ]|DOCUMENTA[TŢȚ]IE\s+MEDICAL|SIA\s+AMP|CMF\s*nr/i.test(
      t,
    ))
  ) {
    return "Consultație";
  }
  if (/CONSULTATIE\s+MEDICAL[AĂÂ]|CONSULTA[TŢȚ]IE\s+MEDICAL/i.test(t)) {
    return "Consultație";
  }

  // Invitro / lab panels without Medpark bulletin header
  if (
    (/INVITRO|Viteza de sedimentare|Hemoleucograma|felcer laborant/i.test(t) ||
      (/Limfocite/i.test(t) && /Monocite/i.test(t))) &&
    (/%|mm\/or|10\^|x\s*10/i.test(t))
  ) {
    return "BULETIN DE ANALIZE MEDICALE";
  }

  // --- 4. Filename fallbacks (never keep numeric ids) ---
  if (/epicriz|epicrisis/i.test(file)) return "RAPORT MEDICAL";
  if (/laboratory|lab[_-]?result|analize|lisSonuc|buletin/i.test(file)) {
    return "BULETIN DE ANALIZE MEDICALE";
  }
  if (/investigation/i.test(file)) {
    if (/\bIRM\b|\bRMN\b|rezonan/i.test(t)) return "IRM";
    if (/RADIOGRAFIA|RAPORT\s+RADIOLOGY/i.test(t)) return "Radiografie";
    if (/ECOGRAFIA|ultrasunet/i.test(t)) return "Ecografie";
    return "Investigație";
  }
  if (/\birm\b|\brmn\b/i.test(file)) return "IRM";

  return "";
}

function cleanFilenameTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+-/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUglyTitle(title, filename) {
  const value = (title || "").trim();
  if (!value) return true;
  if (/^RAPORT MEDICAL din |^BULETIN DE ANALIZE|^IRM |^Ecografie |^Glandele |^Radiografie |^Consultație|^Decizie |^Extras |^ECG$|^Rețetă|^CT |^Investigație/i.test(value)) {
    return false;
  }
  const fromFile = cleanFilenameTitle(filename || "");
  if (value.toLowerCase() === fromFile.toLowerCase()) return true;
  if (/^id\s+\d+/i.test(value) || /integration\s+id/i.test(value)) return true;
  if (/^pxl\b/i.test(value) || /^\d{10,}$/.test(value)) return true;
  if (/\b\d{6,}\b/.test(value) && value.split(/\s+/).length <= 4) return true;
  if (/^[a-f0-9-]{8,}$/i.test(value)) return true;
  if (/epicrisis|laboratory|investigation/i.test(value) && /\d{5,}/.test(value)) return true;
  return false;
}

function humanTitle({ title, filename, extractedText, documentDate }) {
  const text = extractedText || "";
  const heading = extractHeading(filename || "", text);
  const next = withDate(heading, documentDate || "", text);
  if (next) return next.slice(0, MAX_TITLE);
  return (title || "").trim().slice(0, MAX_TITLE);
}

if (SELF_TEST) {
  const samples = [
    {
      title: "epicrisis 550929213",
      filename: "epicrisis_550929213.pdf",
      documentDate: "2026-09-28",
      extractedText: "SERGIU STICI\n28.09.2026 09:29\nRAPORT MEDICAL\nPOLICLINICA MEDPARK",
    },
    {
      title: "laboratory 560666007",
      filename: "laboratory_560666007.pdf",
      documentDate: "2026-07-15",
      extractedText: "BULETIN DE ANALIZE MEDICALE\nData recoltării probei : 15.07.2026 08:35",
    },
    {
      title: "PXL 20261020 123758897",
      filename: "1-PXL_20261020_123758897.jpg",
      documentDate: "2025-07-28",
      extractedText: "SECȚIA DE ULTRASONOGRAFIE\nStructura gl. mamare cu predominarea țesutului adipos",
    },
    {
      title: "PXL 20261020 182552990",
      filename: "PXL_20261020_182552990.jpg",
      documentDate: "2025-04-03",
      extractedText: "Data de 03.04.2025 11:16\nRAPORT MEDICAL\nPOLICLINICA MEDPARK",
    },
  ];
  const expected = [
    "RAPORT MEDICAL din 28.09.2026",
    "BULETIN DE ANALIZE MEDICALE din 15.07.2026",
    "Glandele mamare",
    "RAPORT MEDICAL din 03.04.2025",
  ];
  let ok = true;
  for (let i = 0; i < samples.length; i++) {
    const next = humanTitle(samples[i]);
    const pass = next === expected[i];
    if (!pass) ok = false;
    console.log(
      `${samples[i].filename}\n  - ${samples[i].title}\n  + ${next}${pass ? "" : `  (așteptat: ${expected[i]})`}\n`,
    );
  }
  process.exit(ok ? 0 : 1);
}

if (!url || !serviceKey) {
  console.error(`
Lipsește NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.

Adaugă temporar în .env.local:
  SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API → service_role)

Apoi:
  node scripts/retitle-documents.mjs           # preview
  node scripts/retitle-documents.mjs --apply   # update
  node scripts/retitle-documents.mjs --sql     # scrie retitle-updates.sql
  node scripts/retitle-documents.mjs --test    # probe heuristici
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
      `${url}/rest/v1/medical_documents?select=id,title,original_filename,extracted_text,record_id,document_date&record_id=is.null&order=created_at.asc&offset=${from}&limit=${pageSize}`,
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
    if (batch.length < pageSize) {
      break;
    }
    from += pageSize;
  }
  return rows;
}

async function updateTitle(id, title) {
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
      body: JSON.stringify({ title }),
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
  const current = (doc.title || "").trim();
  const next = humanTitle({
    title: current,
    filename: doc.original_filename || "",
    extractedText: doc.extracted_text || "",
    documentDate: doc.document_date || "",
  });
  if (!next || next === current) {
    continue;
  }
  if (!ALL && !isUglyTitle(current, doc.original_filename)) {
    continue;
  }
  changes.push({
    id: doc.id,
    date: doc.document_date,
    filename: doc.original_filename,
    from: current || "(gol)",
    to: next,
    excerpt: (doc.extracted_text || "").replace(/\s+/g, " ").trim().slice(0, 120),
  });
}

console.log(
  `Documente principale: ${documents.length}. Propuneri de retitle: ${changes.length}.`,
);
console.log("");

for (const change of changes) {
  console.log(`• ${change.date || "fără dată"}  ${change.filename}`);
  console.log(`  - ${change.from}`);
  console.log(`  + ${change.to}`);
  if (change.excerpt) {
    console.log(`    ↳ ${change.excerpt}`);
  }
  console.log("");
}

if (SQL_OUT) {
  const statements = changes
    .map(
      (change) =>
        `update public.medical_documents set title = '${sqlEscape(change.to)}' where id = '${change.id}';`,
    )
    .join("\n");
  const outPath = resolve("scripts/retitle-updates.sql");
  writeFileSync(
    outPath,
    `-- Generated by retitle-documents.mjs (${changes.length} updates)\nbegin;\n${statements}\ncommit;\n`,
    "utf8",
  );
  console.log(`SQL scris în ${outPath}`);
}

if (APPLY) {
  let done = 0;
  for (const change of changes) {
    await updateTitle(change.id, change.to);
    done += 1;
    console.log(`updated ${done}/${changes.length}: ${change.to}`);
  }
  console.log(`Gata. ${done} titluri actualizate.`);
} else if (!SQL_OUT) {
  console.log("Dry-run. Rulează cu --apply ca să scrii în DB, sau --sql pentru fișier SQL.");
}
