import "server-only";

import { searchCatalog, type CatalogRecord } from "./catalog";

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];
const MAX_ROUNDS = 4;

type ChatTurn = { role: "user" | "assistant"; text: string };

type Part = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type Content = { role: "user" | "model"; parts: Part[] };

const declarations = [
  {
    name: "search_records",
    description:
      "Caută în textul documentelor deja salvate. query conține cuvinte care apar în document, nu o categorie. Apelează înainte să afirmi că o informație există.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Cuvinte sau valori luate din textul documentului",
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
    description: "Citește textul unui document găsit cu search_records.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
      },
      required: ["id"],
    },
  },
];

function systemInstruction(count: number) {
  return [
    "Ești asistentul medical al dosarului de familie.",
    "Ajuți să caute, să filtreze și să consulte documentele deja încărcate.",
    "Răspunzi în română, scurt și clar.",
    "Nu inventa analize, valori, medici, clinici sau date. Dacă nu găsești nimic, spune asta.",
    "Caută doar în textul documentelor, cu search_records, apoi citește documentul cu read_record.",
    "Nu filtra după categorie. Cuvintele din întrebare trebuie să fie cele din document.",
    "Când citezi, menționează persoana, data și titlul.",
    "Nu pui diagnostice și nu înlocuiești un medic. Poți explica ce scrie în documente.",
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
    const id = typeof args.id === "string" ? args.id : "";
    const record = records.find((item) => item.id === id);
    if (!record) {
      return { error: "Documentul nu este în dosar." };
    }
    return {
      id: record.id,
      profile: record.profileName,
      date: record.date,
      title: record.title,
      files: record.files,
      text: record.text.slice(0, 8000),
    };
  }

  return { error: "Unealtă necunoscută." };
}

async function generate(
  apiKey: string,
  instruction: string,
  contents: Content[],
  withTools: boolean,
) {
  let lastStatus = 0;

  for (const model of MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents,
          ...(withTools ? { tools: [{ functionDeclarations: declarations }] } : {}),
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string };
      candidates?: { content?: { parts?: Part[] } }[];
    };

    if (response.ok) {
      return payload.candidates?.[0]?.content?.parts ?? [];
    }

    lastStatus = response.status;
    const message = payload.error?.message ?? "";
    if (/api key/i.test(message) || response.status === 401 || response.status === 403) {
      throw new Error("Cheia Gemini nu este validă.");
    }
    if (response.status === 400) {
      console.error("askMedicalAssistant", response.status);
      throw new Error("Cererea către Gemini a fost respinsă.");
    }
  }

  console.error("askMedicalAssistant", lastStatus);
  if (lastStatus === 429) {
    throw new Error("Limita Gemini a fost atinsă. Încearcă din nou peste câteva minute.");
  }
  throw new Error("Gemini nu a răspuns.");
}

export async function answerMedicalQuestion(input: {
  apiKey: string;
  messages: ChatTurn[];
  records: CatalogRecord[];
}) {
  const instruction = systemInstruction(input.records.length);
  const contents: Content[] = input.messages.slice(-8).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text.slice(0, 4000) }],
  }));

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const parts = await generate(input.apiKey, instruction, contents, true);
    const calls = parts.filter((part) => part.functionCall?.name);
    const text = parts
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

    if (calls.length === 0) {
      return text || "Nu am găsit un răspuns în documente.";
    }

    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: calls.map((part) => {
        const call = part.functionCall!;
        return {
          functionResponse: {
            name: call.name,
            response: runTool(input.records, call.name, call.args ?? {}),
          },
        };
      }),
    });

    if (text && round === MAX_ROUNDS - 1) {
      return text;
    }
  }

  const finalParts = await generate(input.apiKey, instruction, contents, false);
  const text = finalParts
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
  return text || "Nu am putut încheia consultarea documentelor.";
}
