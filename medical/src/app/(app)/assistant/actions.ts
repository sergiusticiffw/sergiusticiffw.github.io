"use server";

import { answerMedicalQuestion } from "@/lib/assistant/chat";
import { loadMedicalCatalog } from "@/lib/assistant/catalog";
import { getFamilyAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AssistantTurn = {
  role: "user" | "assistant";
  text: string;
};

export type AssistantResult = {
  error?: string;
  answer?: string;
};

export async function askMedicalAssistant(
  messages: AssistantTurn[],
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

  const family = await getFamilyAccess();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const catalog = await loadMedicalCatalog(supabase, family.familyId);
  if (catalog.error) {
    return { error: catalog.error };
  }

  try {
    const answer = await answerMedicalQuestion({
      apiKey,
      messages: turns,
      records: catalog.records,
    });
    return { answer };
  } catch (error) {
    console.error(
      "askMedicalAssistant",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      error:
        error instanceof Error
          ? error.message
          : "Asistentul nu a putut consulta documentele.",
    };
  }
}
