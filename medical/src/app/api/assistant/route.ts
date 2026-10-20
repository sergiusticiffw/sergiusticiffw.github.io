import { connection } from "next/server";
import { NextResponse } from "next/server";

import { askMedicalAssistant } from "@/lib/assistant/ask";
import type { AssistantTurn } from "@/lib/assistant/types";

export const maxDuration = 60;

function asTurns(value: unknown): AssistantTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.text !== "string"
    ) {
      return [];
    }
    return [{ role: item.role, text: item.text }];
  });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    preferModel?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json(
      { error: "Cererea nu este validă." },
      { status: 400 },
    );
  }

  const result = await askMedicalAssistant(
    asTurns(body.messages),
    typeof body.preferModel === "string" ? body.preferModel : undefined,
  );
  return NextResponse.json(result);
}
