import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExpenseRaw } from '@stores/expenseStore';
import {
  useLoanList,
  useLoanLoading,
  useLoanPayments,
} from '@stores/loanStore';
import {
  useGoalsEnabled,
  useSettingsCurrency,
} from '@stores/settingsStore';
import { useEmergencyFund } from '@features/goals/store';
import {
  AiError,
  GeminiContent,
  GeminiRequest,
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
  markInterrupted,
  pushToolNotes,
  recentToolNotesText,
  saveChatSession,
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
import {
  formatFamilySummary,
  loadFamilyAiContext,
} from '../tools/familyTools';
import { formatGoalsSummary } from '../tools/goalTools';

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Keeps the last N user+model pairs. Past turns are already text-only. */
const trimHistory = (history: GeminiContent[]) =>
  history.slice(-AI_LIMITS.maxHistoryTurns * 2);

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
  if (!categoryId && !description) return undefined;
  return {
    field_category: categoryId,
    field_description: description,
  };
};

export function useAiChat(apiKey: string) {
  const raw = useExpenseRaw();
  const loans = useLoanList();
  const loanPayments = useLoanPayments();
  const loanLoading = useLoanLoading();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const emergencyFund = useEmergencyFund();
  const [messages, setMessages] = useState<ChatMessage[]>(chatSession.messages);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const shareDescriptions = getShareDescriptions();
  const items = useMemo(() => getAiItems(raw || []), [raw]);
  const loanContext = useMemo(
    () => buildLoanContext(loans, loanPayments, shareDescriptions),
    [loans, loanPayments, shareDescriptions]
  );
  const hasLoans = loanContext.snapshots.length > 0;
  const summary = useMemo(() => {
    let text = buildDataSummary(items, currency || 'MDL', shareDescriptions);
    if (loanContext.summary) text = `${text}\n\n${loanContext.summary}`;
    if (goalsEnabled) {
      text = `${text}\n\n${formatGoalsSummary(emergencyFund, items)}`;
    }
    return text;
  }, [
    items,
    currency,
    shareDescriptions,
    loanContext.summary,
    goalsEnabled,
    emergencyFund,
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
      if (!trimmed || busy || !apiKey) return;
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
        ...trimHistory(chatSession.history),
        userTurn,
      ];
      let previousText = '';
      let tokens = 0;
      let model: string | undefined;
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
          hasLoans,
        },
      });

      try {
        const family = await loadFamilyAiContext();
        const turnSummary = family
          ? `${summary}\n\n${formatFamilySummary(family)}`
          : summary;
        const turnDeclarations = getToolDeclarations({
          hasLoans,
          goalsEnabled,
          hasFamily: !!family,
        });
        const systemInstruction = {
          parts: [
            {
              text: buildChatSystemInstruction(
                turnSummary,
                getAiLanguage(),
                recentToolNotesText()
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
        };

        for (let round = 0; round <= AI_LIMITS.maxToolRounds; round++) {
          const forceAnswer = round === AI_LIMITS.maxToolRounds;
          const request: GeminiRequest = {
            systemInstruction,
            contents,
            tools: [{ functionDeclarations: turnDeclarations }],
            ...(forceAnswer && {
              toolConfig: { functionCallingConfig: { mode: 'NONE' } },
            }),
            generationConfig: {
              maxOutputTokens: AI_LIMITS.chatMaxOutputTokens,
              thinkingConfig: { thinkingLevel: 'low' },
            },
          };

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

          const result = await streamGenerate({
            apiKey,
            tier: 'chat',
            preferModel,
            request,
            signal: controller.signal,
            onText: (text) =>
              patchMessage(assistantId, {
                text: splitFollowUps(
                  previousText ? `${previousText}\n\n${text}` : text
                ).answer,
                activity: undefined,
              }),
            onDebug: (event) => logStreamDebug(event, addDebug),
          });

          const stepTokens = result.usage.totalTokenCount || 0;
          tokens += stepTokens;
          contents.push({
            role: 'model',
            parts: result.parts,
            model: result.model,
          });
          model = result.model;
          if (result.text) {
            previousText = previousText
              ? `${previousText}\n\n${result.text}`
              : result.text;
          }

          if (!result.functionCalls.length || forceAnswer) break;

          patchMessage(assistantId, {
            activity: TOOL_LABELS[result.functionCalls[0].name] || 'Working',
          });
          contents.push({
            role: 'user',
            parts: result.functionCalls.map((call) => {
              const started = Date.now();
              const response = executeTool(call.name, call.args, toolContext);
              const summaryLine = summarizeToolResult(
                call.name,
                call.args,
                response
              );
              turnNotes.push(summaryLine);
              addDebug({
                kind: 'tool',
                title: call.name,
                subtitle: TOOL_LABELS[call.name] || 'Working',
                summary: summaryLine,
                durationMs: Date.now() - started,
                data: {
                  id: call.id || null,
                  arguments: call.args || {},
                  result: response,
                },
              });
              if (call.name === 'suggest_category') {
                prefill = prefillFromSuggest(response) || prefill;
              }
              return {
                functionResponse: {
                  ...(call.id && { id: call.id }),
                  name: call.name,
                  response,
                },
              };
            }),
          });
        }

        const { answer, followUps } = splitFollowUps(previousText);
        if (!answer) {
          throw new AiError('unknown', 'Empty response');
        }

        pushToolNotes(turnNotes);
        chatSession.history = [
          ...chatSession.history,
          userTurn,
          { role: 'model', parts: [{ text: answer }] },
        ];
        if (trace) {
          addDebug({
            kind: 'info',
            title: 'Turn finished',
            subtitle: [
              formatDebugMs(Date.now() - trace.startedAt),
              tokens ? `${tokens.toLocaleString()} tokens` : '',
              model || '',
            ]
              .filter(Boolean)
              .join(' · '),
            data: {
              answer,
              followUps,
              tokens,
              model,
            },
          });
        }
        patchMessage(assistantId, {
          text: answer,
          status: 'done',
          activity: undefined,
          tokens,
          model,
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
          model ||
          AI_MODELS.chat[0];
        const partial = splitFollowUps(previousText).answer;
        if (turnNotes.length) pushToolNotes(turnNotes);
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
          tokens: tokens || undefined,
          failedModel,
          ...(prefill && { prefill }),
          ...(trace && { debug: finishDebugTrace(trace) }),
        });
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [
      apiKey,
      busy,
      currency,
      emergencyFund,
      goalsEnabled,
      hasLoans,
      items,
      loanContext,
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
    reset,
    hasData:
      (loans !== null || !loanLoading) &&
      (items.length > 0 || loanContext.snapshots.length > 0),
    summaryTokens: Math.round(summary.length / 4),
    loans: loanContext.snapshots,
  };
}
