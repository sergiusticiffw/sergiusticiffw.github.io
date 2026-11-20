import { foldText } from "@/lib/timeline";
import {
  labDraftSchema,
  MAX_LAB_ROWS,
  splitReference,
  splitResult,
  type LabDraft,
} from "@/lib/validation/extraction";
import { z } from "zod";

/** Row of `lab_tests` as the app reads it for history and charts. */
export type LabResultRow = {
  id: string;
  source_document_id: string | null;
  test_name: string;
  sample_date: string | null;
  result_value: number | string | null;
  result_text: string | null;
  unit: string | null;
  reference_min: number | string | null;
  reference_max: number | string | null;
  reference_text: string | null;
};

export type LabPoint = {
  recordId: string;
  date: string | null;
  value: number | null;
  text: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  referenceText: string | null;
};

export type LabSeries = {
  key: string;
  name: string;
  unit: string;
  /** Newest first. Values are shown exactly as stored; no unit conversion. */
  points: LabPoint[];
};

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Groups results by test name and unit. Different units are never merged,
 * because converting between them would be an interpretation.
 */
export function buildLabSeries(rows: LabResultRow[]): LabSeries[] {
  const map = new Map<string, LabSeries>();
  for (const row of rows) {
    const name = row.test_name?.trim();
    if (!name) {
      continue;
    }
    const value = asNumber(row.result_value);
    const text = row.result_text?.trim() || null;
    if (value === null && !text) {
      continue;
    }
    const unit = row.unit?.trim() ?? "";
    const key = `${foldText(name)}|${foldText(unit)}`;
    let series = map.get(key);
    if (!series) {
      series = { key, name, unit, points: [] };
      map.set(key, series);
    }
    series.points.push({
      recordId: row.source_document_id ?? row.id,
      date: row.sample_date,
      value,
      text,
      referenceMin: asNumber(row.reference_min),
      referenceMax: asNumber(row.reference_max),
      referenceText: row.reference_text?.trim() || null,
    });
  }

  for (const series of map.values()) {
    series.points.sort((left, right) => {
      if (left.date === right.date) {
        return 0;
      }
      if (!left.date) {
        return 1;
      }
      if (!right.date) {
        return -1;
      }
      return right.date.localeCompare(left.date);
    });
  }

  return [...map.values()].sort((left, right) => {
    const a = left.points[0]?.date ?? "";
    const b = right.points[0]?.date ?? "";
    return b.localeCompare(a) || left.name.localeCompare(right.name, "ro");
  });
}

/**
 * Compares a stored value with the range printed on the document. This is a
 * factual comparison with the lab's own range, not a medical interpretation.
 */
export function compareToReference(point: LabPoint) {
  if (point.value === null) {
    return null;
  }
  if (point.referenceMin !== null && point.value < point.referenceMin) {
    return "below" as const;
  }
  if (point.referenceMax !== null && point.value > point.referenceMax) {
    return "above" as const;
  }
  if (point.referenceMin !== null || point.referenceMax !== null) {
    return "within" as const;
  }
  return null;
}

export const labRowsSchema = z.array(labDraftSchema).max(MAX_LAB_ROWS);

/** Rows the person reviewed and filled in; blank names are dropped. */
export function reviewedLabRows(raw: unknown): LabDraft[] {
  const parsed = labRowsSchema.safeParse(raw);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.filter(
    (row) => row.testName.trim() !== "" && row.result.trim() !== "",
  );
}

export function parseLabRowsField(value: FormDataEntryValue | null): LabDraft[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  try {
    return reviewedLabRows(JSON.parse(value));
  } catch {
    return [];
  }
}

/** Maps reviewed rows to `lab_tests` columns. */
export function labInsertRows(input: {
  profileId: string;
  rows: LabDraft[];
  fallbackDate: string;
  category: string;
  sourceDocumentId?: string | null;
}) {
  return input.rows.map((row) => {
    const result = splitResult(row.result);
    const reference = splitReference(row.reference);
    return {
      profile_id: input.profileId,
      source_document_id: input.sourceDocumentId ?? null,
      test_name: row.testName.trim(),
      category: row.category.trim() || input.category,
      sample_date: row.sampleDate || input.fallbackDate,
      result_value: result.resultValue,
      result_text: result.resultText,
      unit: row.unit.trim() || null,
      reference_min: reference.referenceMin,
      reference_max: reference.referenceMax,
      reference_text: reference.referenceText,
      laboratory: row.laboratory.trim() || null,
      notes: row.notes.trim() || null,
    };
  });
}
