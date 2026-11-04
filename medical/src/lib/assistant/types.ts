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
};

export type AssistantResult = {
  error?: string;
  answer?: string;
  sources?: AssistantSource[];
  failedModel?: string;
  quota?: {
    until: number;
    resetAt: string;
  };
};
