export type AssistantTurn = {
  role: "user" | "assistant";
  text: string;
};

export type AssistantResult = {
  error?: string;
  answer?: string;
  failedModel?: string;
};
