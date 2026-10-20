"use client";

import { useEffect, useRef, useState } from "react";

import { AssistantAnswer } from "@/components/assistant/assistant-answer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { nextChatModel, retryModelLabel } from "@/lib/assistant/models";
import type { AssistantResult, AssistantTurn } from "@/lib/assistant/types";

export function MedicalAssistant({
  enabled,
  suggestions,
}: {
  enabled: boolean;
  suggestions: string[];
}) {
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedModel, setFailedModel] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, error]);

  async function ask(turns: AssistantTurn[], preferModel?: string) {
    setError(null);
    setFailedModel(null);
    setPending(true);
    try {
      const result = await askAssistant(turns, preferModel);
      if (result.error || !result.answer) {
        setError(result.error ?? "Asistentul nu a răspuns.");
        setFailedModel(result.failedModel ?? preferModel ?? null);
        return;
      }
      setMessages([...turns, { role: "assistant", text: result.answer }]);
    } catch (error) {
      setError(
        error instanceof Error &&
          error.message &&
          !/digest|server action/i.test(error.message)
          ? error.message
          : "Asistentul nu a putut consulta documentele. Reîncearcă.",
      );
    } finally {
      setPending(false);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) {
      return;
    }
    const next = [...messages, { role: "user" as const, text: question }];
    setMessages(next);
    setInput("");
    await ask(next);
  }

  async function retry(preferModel?: string) {
    const last = messages.at(-1);
    if (!last || last.role !== "user" || pending) {
      return;
    }
    await ask(messages, preferModel);
  }

  const canRetry = Boolean(error) && messages.at(-1)?.role === "user" && !pending;
  const altModel = canRetry ? nextChatModel(failedModel) : null;

  if (!enabled) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-3">
        <p className="max-w-md text-sm text-muted-foreground">
          Adaugă cheia Gemini în <span className="font-medium">GEMINI_API_KEY</span>{" "}
          pe server ca să poți întreba despre documentele din dosar. Cheia se
          creează gratuit în Google AI Studio și rămâne doar pe server.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Întreabă despre dosar. Răspunsul vine din câmpurile salvate, nu
              din fișier.
            </p>
            {suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={pending}
                    className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      void send(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message, index) =>
            message.role === "user" ? (
              <div key={`${message.role}-${index}`} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
                  {message.text}
                </p>
              </div>
            ) : (
              <div key={`${message.role}-${index}`} className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl border bg-card px-3.5 py-2.5 text-sm shadow-sm">
                  <AssistantAnswer text={message.text} />
                </div>
              </div>
            ),
          )
        )}
        {pending ? (
          <div className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
              Caut în documente…
            </p>
          </div>
        ) : null}
        {error ? (
          <div className="flex justify-start">
            <div className="max-w-[92%]">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              {canRetry ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground disabled:opacity-50"
                    onClick={() => {
                      void retry();
                    }}
                  >
                    <RetryIcon />
                    Reîncearcă
                  </button>
                  {altModel ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground disabled:opacity-50"
                      onClick={() => {
                        void retry(altModel);
                      }}
                    >
                      <RetryIcon />
                      Reîncearcă cu {retryModelLabel(altModel)}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => {
              setMessages([]);
              setError(null);
              setFailedModel(null);
            }}
          >
            Chat nou
          </Button>
        ) : null}
        <Textarea
          value={input}
          rows={2}
          placeholder="Întreabă despre dosar…"
          aria-label="Mesaj"
          className="min-h-11 flex-1"
          disabled={pending}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        <Button type="submit" className="h-11" disabled={pending || input.trim().length === 0}>
          Trimite
        </Button>
      </form>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        Asistentul poate greși. Verifică documentul înainte de o decizie medicală.
      </p>
    </div>
  );
}

async function askAssistant(
  messages: AssistantTurn[],
  preferModel?: string,
): Promise<AssistantResult> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, preferModel }),
  });
  const payload = (await response.json().catch(() => null)) as AssistantResult | null;
  if (!payload) {
    return { error: "Asistentul nu a putut consulta documentele." };
  }
  return payload;
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
