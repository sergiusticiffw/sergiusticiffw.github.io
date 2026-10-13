import { z } from "zod";

import { formatBirthDate } from "@/lib/format";
import { DOCUMENT_CATEGORIES } from "@/lib/validation/document";

export const MAX_EXTRACTED_TEXT = 20_000;
export const MAX_LAB_ROWS = 40;

const optionalDate = z.string().trim().refine(
  (value) => {
    if (value === "") {
      return true;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  },
  { message: "Data nu este validă." },
);

export const consultationDraftSchema = z.object({
  doctorName: z.string().trim().max(200),
  clinicName: z.string().trim().max(200),
  specialty: z.string().trim().max(200),
  consultationDate: optionalDate,
  summary: z.string().trim().max(4000),
  recommendations: z.string().trim().max(4000),
});

export const LAB_CATEGORIES = [
  "Hematologie",
  "Biochimie",
  "Imunologie",
  "Hormoni",
  "Microbiologie",
  "Coagulare",
  "Urină",
  "Imagistică",
  "Altele",
] as const;

export const labDraftSchema = z.object({
  testName: z.string().trim().max(200),
  category: z.string().trim().max(120),
  sampleDate: optionalDate,
  result: z.string().trim().max(500),
  unit: z.string().trim().max(40),
  reference: z.string().trim().max(200),
  laboratory: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
});

export const extractionSchema = z.object({
  idnp: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{13}$/.test(value), {
      message: "IDNP are 13 cifre.",
    }),
  extractedText: z.string().max(MAX_EXTRACTED_TEXT),
  consultation: consultationDraftSchema,
  labTests: z.array(labDraftSchema).max(MAX_LAB_ROWS),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ConsultationDraft = z.infer<typeof consultationDraftSchema>;
export type LabDraft = z.infer<typeof labDraftSchema>;

export function emptyConsultation(): ConsultationDraft {
  return {
    doctorName: "",
    clinicName: "",
    specialty: "",
    consultationDate: "",
    summary: "",
    recommendations: "",
  };
}

export function emptyLabTest(): LabDraft {
  return {
    testName: "",
    category: "",
    sampleDate: "",
    result: "",
    unit: "",
    reference: "",
    laboratory: "",
    notes: "",
  };
}

export function consultationIsPresent(consultation: ConsultationDraft) {
  return Object.values(consultation).some((value) => value.trim() !== "");
}

export function presentLabTests(labTests: LabDraft[]) {
  return labTests.filter((row) => row.testName.trim() !== "");
}

export function recordDate(extraction: Extraction) {
  return (
    extraction.consultation.consultationDate ||
    extraction.labTests.find((row) => row.sampleDate)?.sampleDate ||
    ""
  );
}

export function recordCategory(extraction: Extraction) {
  const hasConsultation = consultationIsPresent(extraction.consultation);
  const hasLabs = presentLabTests(extraction.labTests).length > 0;
  if (hasLabs && !hasConsultation) {
    return "Analize" as const;
  }
  if (hasConsultation) {
    return "Consultație" as const;
  }
  return "Alte documente" as const;
}

function line(label: string, value: string) {
  return value.trim() ? `${label}: ${value.trim()}` : "";
}

function datedHeading(title: string, date: string) {
  const formatted = formatBirthDate(date);
  return formatted ? `${title} · ${formatted}` : title;
}

function sharedValue(values: string[]) {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.length === 1 ? unique[0] : "";
}

function labBlock(row: LabDraft, recordDay: string, sharedLaboratory: string) {
  const result = [row.result.trim(), row.unit.trim()].filter(Boolean).join(" ");
  const headline = result ? `${row.testName.trim()} — ${result}` : row.testName.trim();
  const details = [
    row.reference.trim() ? `Interval: ${row.reference.trim()}` : "",
    row.laboratory.trim() && row.laboratory.trim() !== sharedLaboratory
      ? `Laborator: ${row.laboratory.trim()}`
      : "",
    row.category.trim() ? `Categorie: ${row.category.trim()}` : "",
    row.sampleDate && row.sampleDate !== recordDay
      ? `Data: ${formatBirthDate(row.sampleDate) ?? row.sampleDate}`
      : "",
    row.notes.trim() ? row.notes.trim() : "",
  ].filter(Boolean);

  return [headline, ...details.map((detail) => `  ${detail}`)].join("\n");
}

export function recordBody(extraction: Extraction) {
  const consultation = extraction.consultation;
  const labs = presentLabTests(extraction.labTests);
  const day = recordDate(extraction);
  const sections: string[] = [];

  if (extraction.idnp) {
    sections.push(`IDNP: ${extraction.idnp}`);
  }

  if (consultationIsPresent(consultation)) {
    const summary = consultation.summary.trim();
    const recommendations = consultation.recommendations.trim();
    sections.push(
      [
        datedHeading("Consultație", consultation.consultationDate),
        line("Medic", consultation.doctorName),
        line("Clinică", consultation.clinicName),
        line("Specialitate", consultation.specialty),
        summary ? `Rezumat\n${summary}` : "",
        recommendations ? `Recomandări\n${recommendations}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (labs.length > 0) {
    const laboratory = sharedValue(labs.map((row) => row.laboratory));
    sections.push(
      [
        datedHeading("Analize", day),
        laboratory ? `Laborator: ${laboratory}` : "",
        "",
        labs.map((row) => labBlock(row, day, laboratory)).join("\n\n"),
      ]
        .filter((part) => part !== "")
        .join("\n"),
    );
  }

  const rawText = extraction.extractedText.trim();
  if (rawText && !consultationIsPresent(consultation) && labs.length === 0) {
    sections.push(rawText);
  }

  return sections.join("\n\n").slice(0, MAX_EXTRACTED_TEXT);
}

export function isDocumentCategory(
  value: string,
): value is (typeof DOCUMENT_CATEGORIES)[number] {
  return DOCUMENT_CATEGORIES.some((category) => category === value);
}

const numberPattern = /^-?\d+(?:\.\d+)?$/;
const rangePattern =
  /^(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)$/;

export function splitResult(result: string) {
  const trimmed = result.trim();
  const normalized = trimmed.replace(",", ".");
  if (numberPattern.test(normalized)) {
    return { resultValue: Number(normalized), resultText: null as string | null };
  }
  return {
    resultValue: null as number | null,
    resultText: trimmed === "" ? null : trimmed,
  };
}

export function splitReference(reference: string) {
  const trimmed = reference.trim();
  const match = trimmed.match(rangePattern);
  if (!match) {
    return {
      referenceMin: null as number | null,
      referenceMax: null as number | null,
      referenceText: trimmed === "" ? null : trimmed,
    };
  }
  return {
    referenceMin: Number(match[1].replace(",", ".")),
    referenceMax: Number(match[2].replace(",", ".")),
    referenceText: trimmed,
  };
}
