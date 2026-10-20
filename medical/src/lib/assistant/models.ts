export const AI_MODELS = {
  chat: [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3.1-pro-preview",
    "gemini-4-argon",
  ],
  lite: [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-2.5-pro",
  ],
} as const;

export const MODEL_LABELS: Record<string, string> = {
  "gemini-4-argon": "Gemini 4 Argon",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3-flash-preview": "Gemini 3 Flash",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
};

export function modelLabel(model: string) {
  return MODEL_LABELS[model] ?? model.replace(/^gemini-/, "Gemini ");
}

export function retryModelLabel(model: string) {
  return model.replace(/^gemini-/, "");
}

export function nextChatModel(after?: string | null) {
  const list = AI_MODELS.chat as readonly string[];
  const index = after ? list.indexOf(after) : 0;
  if (index >= 0) {
    return list[index + 1] ?? null;
  }
  return list[1] ?? null;
}

export function isKnownModel(model: string) {
  return (
    (AI_MODELS.chat as readonly string[]).includes(model) ||
    (AI_MODELS.lite as readonly string[]).includes(model)
  );
}
