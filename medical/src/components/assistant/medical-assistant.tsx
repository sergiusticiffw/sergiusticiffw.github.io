"use client";

import { useEffect, useRef, useState } from "react";

import {
  askMedicalAssistant,
  type AssistantTurn,
} from "@/app/(app)/assistant/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, error]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) {
      return;
    }
    const next = [...messages, { role: "user" as const, text: question }];
    setMessages(next);
    setInput("");
    setError(null);
    setPending(true);
    const result = await askMedicalAssistant(next);
    setPending(false);
    if (result.error || !result.answer) {
      setError(result.error ?? "Asistentul nu a răspuns.");
      return;
    }
    setMessages([...next, { role: "assistant", text: result.answer }]);
  }

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
              Întreabă despre ce scrie în documente. Răspunsul vine doar din
              textul salvat.
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
                <div className="max-w-[85%] rounded-2xl border bg-card px-3 py-2 text-sm shadow-sm">
                  <p className="whitespace-pre-wrap">{message.text}</p>
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
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
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
