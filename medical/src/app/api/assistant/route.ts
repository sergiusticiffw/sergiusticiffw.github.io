import { connection } from "next/server";
import { NextResponse } from "next/server";

import { askMedicalAssistant } from "@/lib/assistant/ask";
import type { AssistantTurn } from "@/lib/assistant/types";
import { getCurrentUser } from "@/lib/auth";

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
    return [{ role: item.role, text: item.text.slice(0, MAX_TURN_CHARS) }];
  });
}

// Best-effort per-user limit (per server instance) so one account cannot burn
// the family's AI quota or run up provider costs.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TURN_CHARS = 2000;
const recentRequests = new Map<string, number[]>();

function tooManyRequests(userId: string) {
  const now = Date.now();
  const recent = (recentRequests.get(userId) ?? []).filter(
    (time) => now - time < WINDOW_MS,
  );
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    recentRequests.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentRequests.set(userId, recent);
  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) {
      if (times.every((time) => now - time >= WINDOW_MS)) {
        recentRequests.delete(key);
      }
    }
  }
  return false;
}

export async function POST(request: Request) {
  await connection();
  const user = await getCurrentUser();
  if (tooManyRequests(user.id)) {
    return NextResponse.json(
      { error: "Prea multe întrebări într-un minut. Așteaptă puțin." },
      { status: 429 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    preferModel?: unknown;
    profileScope?: unknown;
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
    typeof body.profileScope === "string" ? body.profileScope : null,
    request.signal,
  );
  return NextResponse.json(result);
}
