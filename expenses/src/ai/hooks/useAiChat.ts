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
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', text: trimmed, status: 'done' },
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          status: 'streaming',
          activity: 'Thinking',
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
              const response = executeTool(call.name, call.args, toolContext);
              turnNotes.push(summarizeToolResult(call.name, call.args, response));
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
        patchMessage(assistantId, {
          text: answer,
          status: 'done',
          activity: undefined,
          tokens,
          model,
          ...(followUps.length && { followUps }),
          ...(prefill && { prefill }),
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
        });
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [
      apiKey,
      busy,
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
