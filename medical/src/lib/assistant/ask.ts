import "server-only";

import { answerMedicalQuestion } from "@/lib/assistant/chat";
import {
  loadMedicalCatalog,
  parsePeriodHints,
} from "@/lib/assistant/catalog";
import { isKnownModel } from "@/lib/assistant/models";
import type { AssistantResult, AssistantTurn } from "@/lib/assistant/types";
import { getAiRuntime, nextGeminiReset } from "@/lib/assistant/usage";
import { getFamilyAccess } from "@/lib/auth";
import { formatDurationUntil } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

function quotaErrorMessage(base: string) {
  const runtime = getAiRuntime();
  const now = Date.now();
  const soonest = Object.values(runtime.cooldowns)
    .filter((until) => until > now)
    .sort((left, right) => left - right)[0];
  const until = soonest ?? nextGeminiReset().getTime();
  const wait = formatDurationUntil(until, now);
  if (/limită|quota|429/i.test(base)) {
    return `Limita Gemini a fost atinsă. Reîncearcă în ~${wait} (reset zilnic pe fusul Gemini).`;
  }
  return base;
}

export async function askMedicalAssistant(
  messages: AssistantTurn[],
  preferModel?: string,
  profileScope?: string | null,
): Promise<AssistantResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { error: "Cheia Gemini lipsește de pe server." };
  }

  const turns = messages
    .slice(-8)
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string",
    )
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 2000),
    }))
    .filter((message) => message.text.length > 0);

  const last = turns.at(-1);
  if (!last || last.role !== "user") {
    return { error: "Scrie o întrebare." };
  }

  try {
    const family = await getFamilyAccess();
    if (!family.familyId) {
      return { error: family.error ?? "Familia nu a putut fi încărcată." };
    }

    const supabase = await createClient();
    const period = parsePeriodHints(last.text);
    const catalog = await loadMedicalCatalog(supabase, family.familyId, period);
    if (catalog.error) {
      return { error: catalog.error };
    }

    const scope = profileScope?.trim() ?? "";
    const scopedPeople = scope
      ? catalog.people.filter((person) =>
          person.display_name.toLocaleLowerCase("ro").includes(
            scope.toLocaleLowerCase("ro"),
          ) || person.id === scope,
        )
      : catalog.people;
    const people =
      scope && scopedPeople.length > 0 ? scopedPeople : catalog.people;
    const peopleIds = new Set(people.map((person) => person.id));
    const records =
      scope && scopedPeople.length > 0
        ? catalog.records.filter((record) => peopleIds.has(record.profileId))
        : catalog.records;

    const result = await answerMedicalQuestion({
      apiKey,
      familyId: family.familyId,
      messages: turns,
      records,
      people,
      preferModel:
        preferModel && isKnownModel(preferModel) ? preferModel : undefined,
    });
    return { answer: result.answer, sources: result.sources };
  } catch (error) {
    console.error(
      "askMedicalAssistant",
      error instanceof Error ? error.message : "unknown",
    );
    const message =
      error instanceof Error
        ? quotaErrorMessage(error.message)
        : "Asistentul nu a putut consulta documentele.";
    return {
      error: message,
      failedModel:
        error &&
        typeof error === "object" &&
        "failedModel" in error &&
        typeof error.failedModel === "string"
          ? error.failedModel
          : undefined,
      quota:
        /limită Gemini|quota/i.test(message)
          ? {
              until: Object.values(getAiRuntime().cooldowns).sort(
                (left, right) => left - right,
              )[0] ?? nextGeminiReset().getTime(),
              resetAt: nextGeminiReset().toISOString(),
            }
          : undefined,
    };
  }
}
