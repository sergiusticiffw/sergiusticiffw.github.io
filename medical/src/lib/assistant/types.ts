export type AssistantSource = {
  id: string;
  title: string;
  date: string | null;
  profile: string;
  href: string | null;
};

export type AssistantTurn = {
  role: "user" | "assistant";
  text: string;
  sources?: AssistantSource[];
  /** Gemini model that wrote an assistant answer. */
  model?: string;
};

export type AssistantResult = {
  error?: string;
  answer?: string;
  sources?: AssistantSource[];
  model?: string;
  failedModel?: string;
  quota?: {
    until: number;
    resetAt: string;
  };
};
