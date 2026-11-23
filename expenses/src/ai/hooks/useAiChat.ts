import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExpenseRaw } from '@stores/expenseStore';
import {
  useLoanList,
  useLoanLoading,
  useLoanPayments,
} from '@stores/loanStore';
import {
  useGoalsEnabled,
  useLoansEnabled,
  useNetWorthEnabled,
  useSettingsCurrency,
} from '@stores/settingsStore';
import { useEmergencyFund } from '@features/goals/store';
import { computeLoanLiabilities } from '@features/netWorth/loanLiabilities';
import { buildNetWorth } from '@features/netWorth/model';
import { useNetWorthAssets } from '@features/netWorth/assetsStore';
import {
  AiError,
  GeminiContent,
  StreamDebugEvent,
  describeAiError,
  streamGenerate,
} from '../client';
import { AI_LIMITS, AI_MODELS } from '../config';
import {
  ChatMessage,
  TransactionPrefill,
  chatSession,
  clearChatSession,
  historyForRequest,
  markInterrupted,
  pushToolNotes,
  recentToolNotesText,
  saveChatSession,
  toHistoryText,
} from '../chatSession';
import { buildDataSummary } from '../context/summary';
import {
  createDebugTrace,
  finishDebugTrace,
  formatDebugBytes,
  formatDebugMs,
  formatDebugUsage,
  isAiDebugEnabled,
  pushDebugStep,
  snapshotRequest,
  snapshotResponse,
  snapshotTrace,
} from '../debug';
import { getAiItems } from '../data';
import { buildLoanContext } from '../loans';
import { buildChatSystemInstruction, splitFollowUps } from '../prompts';
import { recordAiQuestion } from '../sessionStats';
import { getAiLanguage, getShareDescriptions } from '../storage';
import { getToolDeclarations } from '../tools/definitions';
import { TOOL_LABELS, executeTool } from '../tools/executors';
import { summarizeToolResult } from '../tools/expenseTools';
import { runToolLoop, type ToolLoopState, type ToolLoopStep } from '../runChat';
import {
  formatFamilySummary,
  hasActiveFamilyMembership,
  loadFamilyAiContext,
} from '../tools/familyTools';
import { formatGoalsSummary } from '../tools/goalTools';
import { formatNetWorthSummary } from '../tools/netWorthTools';

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const logStreamDebug = (
  event: StreamDebugEvent,
  addDebug: (step: Parameters<typeof pushDebugStep>[1]) => void
) => {
  switch (event.type) {
    case 'skipped':
      addDebug({
        kind: 'warn',
        title: `Skipped ${event.model}`,
        subtitle:
          event.reason === 'cooldown'
            ? `On cooldown${event.until ? ` until ${new Date(event.until).toLocaleTimeString()}` : ''}`
            : 'Not available for this key',
        data: {
          model: event.model,
          reason: event.reason,
          until: event.until,
        },
      });
      return;
    case 'attempt': {
      const payload = snapshotRequest(event.model, event.url, event.request);
      addDebug({
        kind: 'request',
        title: event.model,
        subtitle: `${formatDebugBytes(payload)} · ${event.request.contents.length} turn${
          event.request.contents.length === 1 ? '' : 's'
        }`,
        data: payload,
      });
      return;
    }
    case 'http_error':
      addDebug({
        kind: 'error',
        title: `HTTP ${event.status} · ${event.model}`,
        subtitle: event.error.message,
        durationMs: event.durationMs,
        data: {
          model: event.model,
          status: event.status,
          kind: event.error.kind,
          message: event.error.message,
          daily: event.error.daily,
          retryAfterSeconds: event.error.retryAfterSeconds,
          quota: event.error.quota,
        },
      });
      return;
    case 'success': {
      const payload = snapshotResponse(event.result, event.chunkCount);
      const calls = event.result.functionCalls.length;
      addDebug({
        kind: 'response',
        title: event.model,
        subtitle: [
          event.result.finishReason,
          calls
            ? `${calls} tool call${calls === 1 ? '' : 's'}`
            : event.result.text
              ? 'text'
              : 'empty',
          `${event.chunkCount} chunk${event.chunkCount === 1 ? '' : 's'}`,
          formatDebugUsage(event.result.usage),
        ]
          .filter(Boolean)
          .join(' · '),
        durationMs: event.durationMs,
        data: payload,
      });
    }
  }
};

const prefillFromSuggest = (
  result: Record<string, unknown>
): TransactionPrefill | undefined => {
  const payload = result.prefill;
  if (!payload || typeof payload !== 'object') return undefined;
  const raw = payload as Record<string, unknown>;
  const categoryId = String(raw.categoryId || result.categoryId || '').trim();
  let description = String(raw.description || result.query || '').trim();
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  for (const tag of tags) {
    const hash = tag.startsWith('#') ? tag : `#${tag}`;
    if (!description.toLowerCase().includes(hash.toLowerCase())) {
      description = description ? `${description} ${hash}` : hash;
    }
  }
  const amount = Number(raw.amount);
  const date = String(raw.date || '').trim();
  if (!categoryId && !description && !(amount > 0)) return undefined;
  return {
    field_category: categoryId,
    field_description: description,
    ...(amount > 0 ? { field_amount: String(amount) } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { field_date: date } : {}),
  };
};

export function useAiChat(apiKey: string) {
  const raw = useExpenseRaw();
  const loans = useLoanList();
  const loanPayments = useLoanPayments();
  const loanLoading = useLoanLoading();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const loansEnabled = useLoansEnabled();
  const emergencyFund = useEmergencyFund();
  const netWorthEnabled = useNetWorthEnabled();
  const netWorthAssets = useNetWorthAssets();
  const [messages, setMessages] = useState<ChatMessage[]>(chatSession.messages);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // State updates are async, so two quick sends could both pass the `busy` check.
  const busyRef = useRef(false);
  // Set while a request is aborted on purpose to resend it with another model.
  const switchingRef = useRef<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    assistantId: string;
    model: string;
  } | null>(null);

  const shareDescriptions = getShareDescriptions();
  const items = useMemo(() => getAiItems(raw || []), [raw]);
  const loanContext = useMemo(
    () =>
      loansEnabled
        ? buildLoanContext(loans, loanPayments, shareDescriptions)
        : buildLoanContext(null, null, shareDescriptions),
    [loansEnabled, loans, loanPayments, shareDescriptions]
  );
  const hasLoans = loansEnabled && loanContext.snapshots.length > 0;
  const loansLoaded = loansEnabled && loans !== null;
  // Same figures as the Net Worth page. Emergency fund only when Goals is on;
  // loan liabilities only when Loans is on.
  const netWorth = useMemo(
    () =>
      netWorthEnabled
        ? buildNetWorth({
            emergencyFund: goalsEnabled ? emergencyFund.balance : 0,
            cash: 0,
            customAssets: netWorthAssets.items,
            loans: loansEnabled
              ? computeLoanLiabilities(loans, loanPayments)
              : [],
          })
        : null,
    [
      netWorthEnabled,
      goalsEnabled,
      loansEnabled,
      emergencyFund.balance,
      netWorthAssets.items,
      loans,
      loanPayments,
    ]
  );
  const summary = useMemo(() => {
    let text = buildDataSummary(items, currency || 'MDL', shareDescriptions);
    if (loansEnabled && loanContext.summary) {
      text = `${text}\n\n${loanContext.summary}`;
    }
    if (goalsEnabled) {
      text = `${text}\n\n${formatGoalsSummary(emergencyFund, items)}`;
    }
    if (netWorth) {
      text = `${text}\n\n${formatNetWorthSummary(netWorth, {
        goalsEnabled,
        loansLoaded,
      })}`;
    }
    return text;
  }, [
    items,
    currency,
    shareDescriptions,
    loansEnabled,
    loanContext.summary,
    goalsEnabled,
    emergencyFund,
    netWorth,
    loansLoaded,
  ]);
  useEffect(() => {
    chatSession.messages = messages;
    // Streaming updates are frequent; the finished answer is saved once.
    if (!messages.some((m) => m.status === 'streaming')) saveChatSession();
  }, [messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      chatSession.messages = markInterrupted(chatSession.messages);
      saveChatSession();
    },
    []
  );

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const send = useCallback(
    async (question: string, preferModel?: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy || busyRef.current || !apiKey) return;
      busyRef.current = true;
      recordAiQuestion();

      const assistantId = newId();
      const trace = isAiDebugEnabled() ? createDebugTrace() : null;
      const publishDebug = () => {
        if (trace) patchMessage(assistantId, { debug: snapshotTrace(trace) });
      };
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', text: trimmed, status: 'done' },
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          status: 'streaming',
          activity: 'Thinking',
          ...(trace && { debug: snapshotTrace(trace) }),
        },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const userTurn: GeminiContent = {
        role: 'user',
        parts: [{ text: trimmed }],
      };
      const contents: GeminiContent[] = [
        ...historyForRequest(chatSession.history, shareDescriptions),
        userTurn,
      ];
      const savedTurns = (answerText: string): GeminiContent[] => [
        { ...userTurn, shared: shareDescriptions },
        {
          role: 'model',
          parts: [{ text: toHistoryText(answerText) }],
          shared: shareDescriptions,
        },
      ];
      const loopState: ToolLoopState = {
        text: '',
        tokens: 0,
        model: undefined,
        toolCalls: [],
      };
      let prefill: TransactionPrefill | undefined;
      const turnNotes: string[] = [];

      const addDebug = (step: Parameters<typeof pushDebugStep>[1]) => {
        if (!trace) return;
        pushDebugStep(trace, step);
        publishDebug();
      };

      addDebug({
        kind: 'info',
        title: 'Turn started',
        subtitle: `${items.length.toLocaleString()} items · ~${Math.round(summary.length / 4).toLocaleString()} summary tokens`,
        data: {
          question: trimmed,
          language: getAiLanguage(),
          shareDescriptions,
          currency,
          itemCount: items.length,
          historyTurns: Math.floor(chatSession.history.length / 2),
          summaryChars: summary.length,
          summaryTokensEstimate: Math.round(summary.length / 4),
          preferModel: preferModel || null,
          maxToolRounds: AI_LIMITS.maxToolRounds,
          maxOutputTokens: AI_LIMITS.chatMaxOutputTokens,
          goalsEnabled,
          loansEnabled,
          hasLoans,
          netWorthEnabled: !!netWorth,
        },
      });

      try {
        const familyRaw = await loadFamilyAiContext(items);
        const family = hasActiveFamilyMembership(familyRaw)
          ? familyRaw
          : null;
        const turnSummary = family
          ? `${summary}\n\n${formatFamilySummary(family)}`
          : summary;
        const turnDeclarations = getToolDeclarations({
          loansEnabled,
          hasLoans,
          goalsEnabled,
          hasFamily: !!family,
          netWorthEnabled: !!netWorth,
        });
        const systemInstruction = {
          parts: [
            {
              text: buildChatSystemInstruction(
                turnSummary,
                getAiLanguage(),
                recentToolNotesText(shareDescriptions)
              ),
            },
          ],
        };
        const toolContext = {
          items,
          shareDescriptions,
          loans: loanContext.snapshots,
          loanPayments: loanContext.payments,
          loanSources: loanContext.sources,
          goalsEnabled,
          emergencyFund: goalsEnabled ? emergencyFund : null,
          family,
          netWorthEnabled: !!netWorth,
          netWorth,
          loansLoaded,
        };

        // One streamed model call. The slow-request offer and the stream
        // handlers live here; the loop itself is in runChat.ts.
        const generateStep = (step: ToolLoopStep) => {
          let attemptModel: string | undefined;
          const slowTimer = setTimeout(() => {
            patchMessage(assistantId, {
              slowModel: attemptModel || preferModel || AI_MODELS.chat[0],
            });
          }, AI_LIMITS.slowRequestMs);
          return streamGenerate({
            apiKey,
            tier: 'chat',
            preferModel,
            request: step.request,
            signal: controller.signal,
            onText: (text) =>
              patchMessage(assistantId, {
                text: splitFollowUps(
                  step.previousText ? `${step.previousText}\n\n${text}` : text
                ).answer,
                activity: undefined,
              }),
            onDebug: (event) => {
              if (event.type === 'attempt') attemptModel = event.model;
              logStreamDebug(event, addDebug);
            },
          }).finally(() => {
            clearTimeout(slowTimer);
            patchMessage(assistantId, { slowModel: undefined });
          });
        };

        await runToolLoop({
          state: loopState,
          contents,
          systemInstruction,
          declarations: turnDeclarations,
          generate: generateStep,
          executeTool: (name, args) => executeTool(name, args, toolContext),
          events: {
            onRound: ({ round, forceAnswer }) => {
              if (forceAnswer) {
                addDebug({
                  kind: 'warn',
                  title: 'Forcing an answer',
                  subtitle: `Reached ${AI_LIMITS.maxToolRounds} tool rounds`,
                });
              }
              addDebug({
                kind: 'info',
                title: `Round ${round + 1}`,
                subtitle: forceAnswer
                  ? 'Model must answer without tools'
                  : 'Model may call tools',
              });
            },
            onToolStart: (name) =>
              patchMessage(assistantId, {
                activity: TOOL_LABELS[name] || 'Working',
              }),
            onToolCall: ({ id, name, args, response, durationMs }) => {
              const summaryLine = summarizeToolResult(name, args, response);
              // A failed call says nothing durable; keeping it would make the
              // model repeat the failure instead of trying the tool again.
              if (!response.error) turnNotes.push(summaryLine);
              addDebug({
                kind: 'tool',
                title: name,
                subtitle: TOOL_LABELS[name] || 'Working',
                summary: summaryLine,
                durationMs,
                data: {
                  id: id || null,
                  arguments: args || {},
                  result: response,
                },
              });
              if (name === 'suggest_category' || name === 'prepare_transaction') {
                prefill = prefillFromSuggest(response) || prefill;
              }
            },
          },
        });

        const { answer, followUps } = splitFollowUps(loopState.text);
        if (!answer) {
          throw new AiError('unknown', 'Empty response');
        }

        pushToolNotes(turnNotes);
        chatSession.history = [...chatSession.history, ...savedTurns(answer)];
        if (trace) {
          addDebug({
            kind: 'info',
            title: 'Turn finished',
            subtitle: [
              formatDebugMs(Date.now() - trace.startedAt),
              loopState.tokens
                ? `${loopState.tokens.toLocaleString()} tokens`
                : '',
              loopState.model || '',
            ]
              .filter(Boolean)
              .join(' · '),
            data: {
              answer,
              followUps,
              tokens: loopState.tokens,
              model: loopState.model,
            },
          });
        }
        patchMessage(assistantId, {
          text: answer,
          status: 'done',
          activity: undefined,
          tokens: loopState.tokens,
          model: loopState.model,
          ...(followUps.length && { followUps }),
          ...(prefill && { prefill }),
          ...(trace && { debug: finishDebugTrace(trace) }),
        });
      } catch (error) {
        const stopped = controller.signal.aborted;
        const errorText = describeAiError(error);
        const failedModel =
          (error instanceof AiError && error.model) ||
          preferModel ||
          loopState.model ||
          AI_MODELS.chat[0];
        const partial = splitFollowUps(loopState.text).answer;
        // A switch resends the same question, so nothing from this attempt is kept.
        const switching = switchingRef.current === assistantId;
        if (turnNotes.length && !switching) pushToolNotes(turnNotes);
        // A stopped answer stays in the model's context. Failed ones are not
        // saved because "retry" asks the same question again.
        if (stopped && partial && !switching) {
          chatSession.history = [
            ...chatSession.history,
            ...savedTurns(partial),
          ];
        }
        if (trace) {
          addDebug({
            kind: stopped ? 'warn' : 'error',
            title: stopped ? 'Stopped' : 'Turn failed',
            subtitle: errorText,
            data:
              error instanceof AiError
                ? {
                    kind: error.kind,
                    message: error.message,
                    model: error.model,
                    daily: error.daily,
                    retryAfterSeconds: error.retryAfterSeconds,
                    quota: error.quota,
                  }
                : { message: (error as Error)?.message || String(error) },
          });
        }
        patchMessage(assistantId, {
          text:
            stopped || !partial
              ? partial || errorText
              : `${partial}\n\n_${errorText}_`,
          status: stopped ? 'stopped' : 'error',
          activity: undefined,
          tokens: loopState.tokens || undefined,
          failedModel,
          ...(prefill && { prefill }),
          ...(trace && { debug: finishDebugTrace(trace) }),
        });
      } finally {
        abortRef.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    },
    [
      apiKey,
      busy,
      currency,
      emergencyFund,
      goalsEnabled,
      loansEnabled,
      hasLoans,
      items,
      loanContext,
      loansLoaded,
      netWorth,
      patchMessage,
      shareDescriptions,
      summary,
    ]
  );

  /** Re-asks the question behind a failed answer, replacing both messages. */
  const retry = useCallback(
    (assistantId: string, preferModel?: string) => {
      if (busy) return;
      const index = messages.findIndex((m) => m.id === assistantId);
      const question = messages[index - 1];
      if (index < 1 || question?.role !== 'user') return;
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantId && m.id !== question.id)
      );
      send(question.text, preferModel);
    },
    [busy, messages, send]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Aborts the running request and asks the same question again with `model`. */
  const switchModel = useCallback((assistantId: string, model: string) => {
    if (!abortRef.current) return;
    switchingRef.current = assistantId;
    setPendingSwitch({ assistantId, model });
    abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (busy || !pendingSwitch) return;
    const { assistantId, model } = pendingSwitch;
    setPendingSwitch(null);
    switchingRef.current = null;
    retry(assistantId, model);
  }, [busy, pendingSwitch, retry]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearChatSession();
    setMessages([]);
  }, []);

  return {
    messages,
    busy,
    send,
    retry,
    stop,
    switchModel,
    reset,
    // When Loans is off we never fetch — do not wait on loanStore.loading (stays true).
    hasData:
      (!loansEnabled || loans !== null || !loanLoading) &&
      (items.length > 0 ||
        (loansEnabled && loanContext.snapshots.length > 0)),
    summaryTokens: Math.round(summary.length / 4),
    loans: loanContext.snapshots,
  };
}
