import "server-only";

import {
  emptyConsultation,
  extractionSchema,
  MAX_EXTRACTED_TEXT,
  MAX_LAB_ROWS,
  type Extraction,
} from "@/lib/validation/extraction";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

const responseSchema = {
  type: "object",
  properties: {
    idnp: { type: "string", nullable: true },
    extractedText: { type: "string" },
    consultation: {
      type: "object",
      nullable: true,
      properties: {
        doctorName: { type: "string", nullable: true },
        clinicName: { type: "string", nullable: true },
        specialty: { type: "string", nullable: true },
        consultationDate: { type: "string", nullable: true },
        summary: { type: "string", nullable: true },
        recommendations: { type: "string", nullable: true },
      },
    },
    labTests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          testName: { type: "string", nullable: true },
          category: { type: "string", nullable: true },
          sampleDate: { type: "string", nullable: true },
          resultValue: { type: "number", nullable: true },
          resultText: { type: "string", nullable: true },
          unit: { type: "string", nullable: true },
          referenceMin: { type: "number", nullable: true },
          referenceMax: { type: "number", nullable: true },
          referenceText: { type: "string", nullable: true },
          laboratory: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
    },
  },
  required: ["extractedText", "labTests"],
};

function clip(value: unknown, max: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, max);
}

function digits(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const only = value.replace(/\D/g, "");
  return only.length === 13 ? only : "";
}

function day(value: unknown) {
  const text = clip(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
    ? text
    : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function referenceFrom(row: Record<string, unknown>) {
  const text = clip(row.referenceText, 200);
  if (text) {
    return text;
  }
  const min = typeof row.referenceMin === "number" ? row.referenceMin : null;
  const max = typeof row.referenceMax === "number" ? row.referenceMax : null;
  if (min !== null && max !== null) {
    return `${min}–${max}`;
  }
  return "";
}

function resultFrom(row: Record<string, unknown>) {
  if (typeof row.resultValue === "number" && Number.isFinite(row.resultValue)) {
    return String(row.resultValue);
  }
  return clip(row.resultText, 500);
}

export function normalizeExtraction(value: unknown): Extraction {
  const record = asRecord(value);
  const consultation = asRecord(record.consultation);
  const labRows = Array.isArray(record.labTests) ? record.labTests : [];

  const draft = {
    idnp: digits(record.idnp),
    extractedText: clip(record.extractedText, MAX_EXTRACTED_TEXT),
    consultation: {
      doctorName: clip(consultation.doctorName, 200),
      clinicName: clip(consultation.clinicName, 200),
      specialty: clip(consultation.specialty, 200),
      consultationDate: day(consultation.consultationDate),
      summary: clip(consultation.summary, 4000),
      recommendations: clip(consultation.recommendations, 4000),
    },
    labTests: labRows.slice(0, MAX_LAB_ROWS).map((item) => {
      const row = asRecord(item);
      return {
        testName: clip(row.testName, 200),
        category: clip(row.category, 120),
        sampleDate: day(row.sampleDate),
        result: resultFrom(row),
        unit: clip(row.unit, 40),
        reference: referenceFrom(row),
        laboratory: clip(row.laboratory, 200),
        notes: clip(row.notes, 2000),
      };
    }),
  };

  const parsed = extractionSchema.safeParse(draft);
  if (!parsed.success) {
    return {
      idnp: "",
      extractedText: "",
      consultation: emptyConsultation(),
      labTests: [],
    };
  }
  return parsed.data;
}

function responseText(payload: {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
}) {
  if (payload.promptFeedback?.blockReason) {
    throw new Error("blocked");
  }
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");
}

function parseModelJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed) as unknown;
}

export async function extractMedicalDocument(input: {
  files: { bytes: Uint8Array; mimeType: string }[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("config");
  }

  const body = {
    systemInstruction: {
      parts: [
        {
          text: [
            "You copy printed text from a medical laboratory report or a doctor consultation into JSON.",
            "Do not diagnose, interpret, or invent values.",
            "Use an empty string when a value is not printed.",
            "idnp is the 13-digit personal number only when those digits are printed.",
            "Dates use YYYY-MM-DD.",
            "When several images are attached, they belong to one record. Merge them.",
            "Put each laboratory analyte in labTests once.",
            "Put the visit narrative in consultation.",
            "extractedText is the readable text from all files, at most 20000 characters.",
          ].join(" "),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          ...input.files.map((file) => ({
            inlineData: {
              mimeType: file.mimeType,
              data: Buffer.from(file.bytes).toString("base64"),
            },
          })),
          {
            text: "Aceste fișiere formează o singură înregistrare. Extrage IDNP-ul, consultația și analizele tipărite.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  let sawQuota = false;
  let sawBusy = false;
  for (const model of MODELS) {
    const response = await fetch(
      `${GEMINI_URL}/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (response.status === 400 || response.status === 404) {
      continue;
    }
    if (response.status === 429) {
      sawQuota = true;
      continue;
    }
    if (response.status === 500 || response.status === 503) {
      sawBusy = true;
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("config");
    }
    if (!response.ok) {
      throw new Error("gemini");
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    const text = responseText(payload);
    if (!text) {
      throw new Error("gemini");
    }
    return normalizeExtraction(parseModelJson(text));
  }

  throw new Error(sawQuota ? "quota" : sawBusy ? "busy" : "gemini");
}
