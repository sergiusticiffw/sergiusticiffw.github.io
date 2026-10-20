import "server-only";

import { searchCatalog, type CatalogRecord } from "./catalog";
import { polishAnswer } from "./format-answer";

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];
const MAX_ROUNDS = 3;
const COOLDOWN_MS = 60_000;
const SKIP_SIGNATURE = "skip_thought_signature_validator";

const unavailableModels = new Set<string>();
const modelCooldown = new Map<string, number>();

type ChatTurn = { role: "user" | "assistant"; text: string };

type Part = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
};

type Content = { role: "user" | "model"; parts: Part[]; model?: string };

const declarations = [
  {
    name: "search_records",
    description:
      "Caută în câmpurile din dosar: persoană, dată, titlu, medic, clinică, rezumat, analize. Apelează înainte să afirmi că o informație există.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Cuvinte din întrebare, fără categorie",
        },
        profile: { type: "STRING", description: "Numele persoanei, parțial" },
        from: { type: "STRING", description: "Data de început, YYYY-MM-DD" },
        to: { type: "STRING", description: "Data de sfârșit, YYYY-MM-DD" },
        limit: { type: "INTEGER" },
      },
    },
  },
  {
    name: "read_record",
    description:
      "Citește câmpurile din dosar pentru înregistrările găsite. Trimite ids cu toate id-urile, nu doar primul.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING", description: "Id-ul unei înregistrări" },
        ids: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Id-urile tuturor înregistrărilor găsite",
        },
      },
    },
  },
];

function systemInstruction(count: number) {
  return [
    "Ești asistentul medical al dosarului de familie.",
    "Răspunzi în română, scurt și clar.",
    "Începe direct cu informația. Fără salut, fără „Sigur”, fără „Iată ce am găsit”.",
    "Formatează răspunsul curat: paragrafe scurte; liste cu - pentru mai multe înregistrări sau valori; ## doar pentru un titlu de secțiune; **evidențiere** doar pentru nume, date și valori.",
    "Fără tabele, fără blocuri de cod, fără emoji, fără IDNP.",
    "Nu inventa analize, valori, medici, clinici sau date. Dacă nu găsești nimic, spune asta.",
    "Caută mai întâi cu search_records. Dacă sunt rezultate, citește-le cu read_record.",
    "Ai doar câmpurile din dosar: persoană, dată, titlu, categorie, medic, clinică, rezumat, analize. Nu ai fișierul și nu ai textul extras din el.",
    "Nu filtra după categorie.",
    "Când citezi, menționează persoana, data și titlul.",
    "Nu pui diagnostice și nu înlocuiești un medic.",
    `Dosarul are ${count} înregistrări.`,
  ].join(" ");
}

function runTool(records: CatalogRecord[], name: string, args: Record<string, unknown>) {
  if (name === "search_records") {
    return searchCatalog(records, {
      query: typeof args.query === "string" ? args.query : "",
      profile: typeof args.profile === "string" ? args.profile : "",
      from: typeof args.from === "string" ? args.from : "",
      to: typeof args.to === "string" ? args.to : "",
      limit: typeof args.limit === "number" ? args.limit : 12,
    });
  }

  if (name === "read_record") {
    const ids = [
      ...(Array.isArray(args.ids) ? args.ids : []),
      args.id,
    ].filter((id): id is string => typeof id === "string" && id.length > 0);
    const found = ids
      .map((id) => records.find((record) => record.id === id))
      .filter((record): record is CatalogRecord => Boolean(record));
    if (found.length === 0) {
      return { error: "Înregistrarea nu este în dosar." };
    }
    return {
      records: found.map((record) => ({
        id: record.id,
        profile: record.profileName,
        date: record.date,
        title: record.title,
        fields: record.fields,
      })),
    };
  }

  return { error: "Unealtă necunoscută." };
}

function contentsFor(contents: Content[], model: string) {
  return contents.map(({ model: author, ...content }) =>
    author && author !== model
      ? {
          ...content,
          parts: content.parts.map((part) =>
            part.thoughtSignature
              ? { ...part, thoughtSignature: SKIP_SIGNATURE }
              : part,
          ),
        }
      : content,
  );
}

function requestBodies(
  instruction: string,
  contents: Content[],
  withTools: boolean,
) {
  const shared = {
    systemInstruction: { parts: [{ text: instruction }] },
    contents,
    ...(withTools ? { tools: [{ functionDeclarations: declarations }] } : {}),
  };
  return [
    {
      ...shared,
      generationConfig: {
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    },
    {
      ...shared,
      generationConfig: { maxOutputTokens: 4096 },
    },
  ];
}

function candidatesFor(preferModel?: string) {
  const start = preferModel ? MODELS.indexOf(preferModel) : 0;
  const models = MODELS.slice(start >= 0 && preferModel ? start : 0).filter(
    (model) => !unavailableModels.has(model),
  );
  const now = Date.now();
  return {
    models,
    candidates: models.filter((model) => (modelCooldown.get(model) ?? 0) <= now),
  };
}

async function generate(
  apiKey: string,
  instruction: string,
  contents: Content[],
  withTools: boolean,
  preferModel?: string,
) {
  const { models, candidates } = candidatesFor(preferModel);
  if (models.length > 0 && candidates.length === 0) {
    throw new Error("Limita Gemini a fost atinsă. Încearcă din nou peste câteva minute.");
  }

  let lastStatus = 0;

  for (const model of candidates) {
    for (const body of requestBodies(
      instruction,
      contentsFor(contents, model),
      withTools,
    )) {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
          },
        );
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          lastStatus = 504;
          continue;
        }
        throw error;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        promptFeedback?: { blockReason?: string };
        candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
      };

      if (response.ok) {
        if (payload.promptFeedback?.blockReason) {
          throw new Error("Gemini a refuzat întrebarea.");
        }
        const parts = payload.candidates?.[0]?.content?.parts ?? [];
        if (parts.length > 0) {
          return { parts, model };
        }
        lastStatus = 204;
        continue;
      }

      lastStatus = response.status;
      const message = payload.error?.message ?? "";
      console.error("askMedicalAssistant", model, response.status);
      if (/api key/i.test(message) || response.status === 401 || response.status === 403) {
        throw new Error("Cheia Gemini nu este validă.");
      }
      if (response.status === 404) {
        unavailableModels.add(model);
        break;
      }
      if (response.status === 429) {
        modelCooldown.set(model, Date.now() + COOLDOWN_MS);
        break;
      }
      if (response.status === 400) {
        continue;
      }
      break;
    }
  }

  console.error("askMedicalAssistant", lastStatus);
  if (lastStatus === 429) {
    throw new Error("Limita Gemini a fost atinsă. Încearcă din nou peste câteva minute.");
  }
  if (lastStatus === 504) {
    throw new Error("Gemini nu a răspuns la timp. Încearcă din nou.");
  }
  throw new Error("Gemini nu a răspuns.");
}

export async function answerMedicalQuestion(input: {
  apiKey: string;
  messages: ChatTurn[];
  records: CatalogRecord[];
}) {
  const instruction = systemInstruction(input.records.length);
  const contents: Content[] = input.messages.slice(-6).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text.slice(0, 2000) }],
  }));

  let model: string | undefined;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const step = await generate(input.apiKey, instruction, contents, true, model);
    model = step.model;
    const calls = step.parts.filter((part) => part.functionCall?.name);
    const text = step.parts
      .map((part) => (part.thought ? "" : part.text?.trim() ?? ""))
      .filter(Boolean)
      .join("\n\n");

    if (calls.length === 0) {
      return polishAnswer(text || "Nu am găsit un răspuns în dosar.");
    }

    contents.push({ role: "model", parts: step.parts, model: step.model });
    contents.push({
      role: "user",
      parts: calls.map((part) => {
        const call = part.functionCall!;
        return {
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name: call.name,
            response: runTool(input.records, call.name, call.args ?? {}),
          },
        };
      }),
    });

    if (text && round === MAX_ROUNDS - 1) {
      return polishAnswer(text);
    }
  }

  const finalStep = await generate(input.apiKey, instruction, contents, false, model);
  const text = finalStep.parts
    .map((part) => (part.thought ? "" : part.text?.trim() ?? ""))
    .filter(Boolean)
    .join("\n\n");
  return polishAnswer(text || "Nu am putut încheia consultarea dosarului.");
}
