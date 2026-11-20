"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AssistantAnswer } from "@/components/assistant/assistant-answer";
import { AssistantSources } from "@/components/assistant/assistant-sources";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  INTERRUPTED,
  chatSession,
  clearChatSession,
  loadChatSession,
  markInterrupted,
  readAssistantScope,
  saveChatSession,
  writeAssistantScope,
} from "@/lib/assistant/chat-session";
import { nextChatModel, retryModelLabel } from "@/lib/assistant/models";
import type { AssistantResult, AssistantTurn } from "@/lib/assistant/types";
import { formatDurationUntil } from "@/lib/format";

/** Bump when what is sent to the AI provider changes, to ask again. */
const CONSENT_VERSION = "1";

function consentKey(userId: string | undefined) {
  return `medicalAssistantConsent:${CONSENT_VERSION}:${userId ?? "anonymous"}`;
}

/**
 * Fixed, constrained request for the doctor-visit summary. It asks only for
 * what is already written in the records and for a source on every point.
 */
function visitPrompt(name: string) {
  return `Pregătește un rezumat pentru vizita la medic a persoanei ${name}, folosind doar ce este notat în dosar: fișa de urgență, ultimele consultații și recomandările lor, analizele recente cu valorile și datele lor. Fă o listă scurtă, cu data fiecărui punct. Nu pune diagnostic, nu interpreta valorile și nu da sfaturi. Pentru fiecare punct citează înregistrarea sursă. Dacă o informație nu există în dosar, spune că lipsește.`;
}

/** Phone keyboards have no Shift key, so Enter must add a new line there. */
function enterSends() {
  try {
    return !window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return true;
  }
}

export function MedicalAssistant({
  enabled,
  suggestions,
  people = [],
  userId,
  initialPersonId,
}: {
  enabled: boolean;
  suggestions: string[];
  people?: { id: string; display_name: string }[];
  userId?: string;
  initialPersonId?: string;
}) {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedModel, setFailedModel] = useState<string | null>(null);
  const [quotaUntil, setQuotaUntil] = useState<number | null>(null);
  const [profileScope, setProfileScope] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    const stored = loadChatSession();
    setMessages(stored.messages);
    setError(stored.error);
    setFailedModel(stored.failedModel);
    setPending(false);
    const requested =
      initialPersonId && people.some((person) => person.id === initialPersonId)
        ? initialPersonId
        : null;
    const saved = requested ?? readAssistantScope();
    if (saved && people.some((person) => person.id === saved)) {
      setProfileScope(saved);
      if (requested) {
        writeAssistantScope(requested);
      }
    }
    try {
      setConsented(localStorage.getItem(consentKey(userId)) === "1");
    } catch {
      setConsented(false);
    }
    setReady(true);
  }, [people, userId, initialPersonId]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    chatSession.messages = messages;
    chatSession.error = error;
    chatSession.failedModel = failedModel;
    chatSession.awaiting = pending;
    saveChatSession();
  }, [ready, messages, error, failedModel, pending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      Object.assign(chatSession, markInterrupted(chatSession));
      saveChatSession();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, error]);

  function chooseScope(next: string | null) {
    setProfileScope(next);
    writeAssistantScope(next);
  }

  function acceptConsent() {
    try {
      localStorage.setItem(consentKey(userId), "1");
    } catch {
      // Without storage the choice only lasts for this visit.
    }
    setConsented(true);
  }

  async function ask(turns: AssistantTurn[], preferModel?: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setFailedModel(null);
    setQuotaUntil(null);
    setPending(true);
    chatSession.messages = turns;
    chatSession.error = null;
    chatSession.failedModel = null;
    chatSession.awaiting = true;
    saveChatSession();

    try {
      const scopeName = profileScope
        ? people.find((person) => person.id === profileScope)?.display_name
        : null;
      const result = await askAssistant(
        turns,
        preferModel,
        scopeName ?? null,
        controller.signal,
      );
      if (controller.signal.aborted) {
        return;
      }
      if (result.error || !result.answer) {
        setError(result.error ?? "Asistentul nu a răspuns.");
        setFailedModel(result.failedModel ?? preferModel ?? null);
        setQuotaUntil(result.quota?.until ?? null);
        return;
      }
      setMessages([
        ...turns,
        {
          role: "assistant",
          text: result.answer,
          ...(result.sources && result.sources.length > 0
            ? { sources: result.sources }
            : {}),
        },
      ]);
      setError(null);
      setFailedModel(null);
      setQuotaUntil(null);
    } catch (askError) {
      if (controller.signal.aborted) {
        setError(INTERRUPTED);
        return;
      }
      setError(
        askError instanceof Error &&
          askError.message &&
          !/digest|server action/i.test(askError.message)
          ? askError.message
          : "Asistentul nu a putut consulta documentele. Reîncearcă.",
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setPending(false);
      }
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending || !consented) {
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

  const scopedPerson = profileScope
    ? (people.find((person) => person.id === profileScope) ?? null)
    : people.length === 1
      ? people[0]
      : null;
  const canRetry = Boolean(error) && messages.at(-1)?.role === "user" && !pending;
  const altModel = canRetry ? nextChatModel(failedModel) : null;
  const quotaWait =
    quotaUntil && quotaUntil > Date.now()
      ? formatDurationUntil(quotaUntil)
      : null;

  if (!enabled) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-3">
        <p className="max-w-md text-sm text-muted-foreground">
          Adaugă cheia Gemini în <span className="font-medium">GEMINI_API_KEY</span>{" "}
          pe server ca să poți întreba despre documentele din dosar. Cheia
          rămâne doar pe server. Folosește un plan Gemini cu facturare: pe
          planul gratuit Google poate folosi întrebările pentru îmbunătățirea
          produselor sale.
        </p>
      </div>
    );
  }

  if (consented === null) {
    return null;
  }

  if (!consented) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4">
        <div className="flex max-w-md flex-col gap-3 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">
            Înainte să folosești asistentul AI
          </h2>
          <p className="text-base text-muted-foreground">
            Când pui o întrebare, textul întrebării și informațiile relevante
            din dosar sunt trimise către Google Gemini ca să fie rezumate:
            numele persoanelor, fișa de urgență (alergii, afecțiuni,
            medicamente, grupa de sânge), notele consultațiilor, valorile
            analizelor și textul extras din documente. Fișierele originale și
            codurile IDNP nu sunt trimise.
          </p>
          <p className="text-base text-muted-foreground">
            Răspunsurile sunt generate automat, pot conține greșeli și nu
            înlocuiesc medicul. Asistentul nu modifică dosarul.
          </p>
          <Button type="button" className="h-11" onClick={acceptConsent}>
            Am înțeles, folosesc asistentul
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {people.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={
              profileScope == null
                ? "min-h-11 rounded-full border-2 border-primary bg-primary/10 px-3.5 py-1 text-sm font-semibold"
                : "min-h-11 rounded-full border px-3.5 py-1 text-sm text-muted-foreground hover:bg-muted"
            }
            aria-pressed={profileScope == null}
            onClick={() => chooseScope(null)}
          >
            Toată familia
          </button>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={
                profileScope === person.id
                  ? "min-h-11 rounded-full border-2 border-primary bg-primary/10 px-3.5 py-1 text-sm font-semibold"
                  : "min-h-11 rounded-full border px-3.5 py-1 text-sm text-muted-foreground hover:bg-muted"
              }
              aria-pressed={profileScope === person.id}
              onClick={() => chooseScope(person.id)}
            >
              {person.display_name}
            </button>
          ))}
        </div>
      ) : null}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversație cu asistentul"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Întreabă despre dosar. Răspunsul vine din câmpurile salvate, nu
              din fișier.
            </p>
            {scopedPerson ? (
              <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-base font-semibold">
                  Pregătește vizita la medic
                </p>
                <p className="text-sm text-muted-foreground">
                  Un rezumat generat de AI din ce este notat în dosarul lui{" "}
                  {scopedPerson.display_name}, cu trimitere la fiecare
                  înregistrare. Nu pune diagnostic și nu dă sfaturi.
                </p>
                <Button
                  type="button"
                  className="h-11 sm:w-fit"
                  disabled={pending}
                  onClick={() => {
                    void send(visitPrompt(scopedPerson.display_name));
                  }}
                >
                  Generează rezumatul
                </Button>
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={pending}
                    className="min-h-11 rounded-lg border px-3 py-2 text-left text-base hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
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
                  <p className="mb-1.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Generat de AI
                  </p>
                  <AssistantAnswer text={message.text} />
                  {message.sources ? (
                    <AssistantSources sources={message.sources} />
                  ) : null}
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
              {quotaWait ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Estimare reset: ~{quotaWait}
                </p>
              ) : null}
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
              abortRef.current?.abort();
              abortRef.current = null;
              clearChatSession();
              setMessages([]);
              setError(null);
              setFailedModel(null);
              setQuotaUntil(null);
              setPending(false);
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
            if (event.key === "Enter" && !event.shiftKey && enterSends()) {
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
        Răspuns generat de AI din datele dosarului, trimise către Google Gemini.
        Poate greși și nu înlocuiește medicul. Verifică documentul original.
      </p>
    </div>
  );
}

async function askAssistant(
  messages: AssistantTurn[],
  preferModel: string | undefined,
  profileScope: string | null,
  signal: AbortSignal,
): Promise<AssistantResult> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, preferModel, profileScope }),
    signal,
  });
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
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
