import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  FiArrowUp,
  FiCheck,
  FiCopy,
  FiChevronLeft,
  FiCreditCard,
  FiKey,
  FiList,
  FiMic,
  FiMicOff,
  FiPieChart,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiShuffle,
  FiSquare,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import LoadingSpinner from '@shared/components/Common/LoadingSpinner';
import { useLocalization } from '@shared/context/localization';
import { fetchExpenses } from '@features/expenses/api/expenses';
import { fetchLoans } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useExpenseData, useExpenseRaw } from '@stores/expenseStore';
import { useLoan } from '@stores/loanStore';
import { modelLabel, nextChatModel } from '../../../../ai/config';
import { ChatMessage } from '../../../../ai/chatSession';
import { getAiItems } from '../../../../ai/data';
import { buildLoanPrompts } from '../../../../ai/loans';
import { buildDataPrompts } from '../../../../ai/dataPrompts';
import { useAiApiKey } from '../../../../ai/hooks/useAiApiKey';
import { useAiChat } from '../../../../ai/hooks/useAiChat';
import { useSpeechInput } from '../../../../ai/hooks/useSpeechInput';
import { getShareDescriptions } from '../../../../ai/storage';
import {
  SuggestedPrompt,
  pickSuggestedPrompts,
} from '../../../../ai/suggestedPrompts';
import type { PromptKind } from '../../../../ai/dataPrompts';
import AiMarkdown from '../../components/AiMarkdown';

const formatTokens = (tokens: number) =>
  tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;

const PROMPT_KIND: Record<
  PromptKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  expense: { label: 'assistant.kindExpense', icon: FiPieChart },
  income: { label: 'assistant.kindIncome', icon: FiTrendingUp },
  loan: { label: 'assistant.kindLoan', icon: FiCreditCard },
};

const ACTIVITY_KEYS: Record<string, string> = {
  Thinking: 'assistant.thinking',
  Working: 'assistant.working',
  'Looking up transactions': 'assistant.lookingUp',
  'Calculating totals': 'assistant.calculating',
  'Summarizing the month': 'assistant.summarizing',
  'Comparing periods': 'assistant.comparing',
  'Checking budgets': 'assistant.checkingBudgets',
  'Comparing budget and spend': 'assistant.comparingBudget',
  'Detecting spend spikes': 'assistant.detectingSpikes',
  'Tracking savings rate': 'assistant.savingsTrend',
  'Reviewing loans': 'assistant.reviewingLoans',
  'Reading the loan': 'assistant.readingLoan',
  'Looking up loan payments': 'assistant.loanPayments',
  'Simulating an extra payment': 'assistant.simulatingExtra',
  'Measuring extra payments': 'assistant.extraImpact',
  'Simulating extra payments': 'assistant.simulatingRecurring',
  'Solving the loan goal': 'assistant.solvingGoal',
  'Simulating a rate change': 'assistant.simulatingRate',
  'Reading the schedule': 'assistant.readingSchedule',
  'Comparing loans': 'assistant.comparingLoans',
  'Comparing prepay and invest': 'assistant.prepayVsInvest',
  'Simulating combined loan changes': 'assistant.simulatingScenario',
  'Suggesting a category': 'assistant.suggestingCategory',
  'Listing category tags': 'assistant.listingTags',
  'Finding similar expenses': 'assistant.findingSimilar',
  'Detecting recurring expenses': 'assistant.detectingRecurring',
};

const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

const AssistantMessage: React.FC<{
  message: ChatMessage;
  onRetry?: () => void;
  onRetryAlt?: () => void;
  onFollowUp?: (question: string) => void;
  onAddPrefill?: () => void;
  altModel?: string | null;
}> = ({ message, onRetry, onRetryAlt, onFollowUp, onAddPrefill, altModel }) => {
  const { t } = useLocalization();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked (non-secure context / permissions).
    }
  };
  const activity = message.activity
    ? t(ACTIVITY_KEYS[message.activity] || 'assistant.working')
    : '';

  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]"
        aria-hidden
      >
        <FiZap />
      </div>
      <div className="min-w-0 flex-1">
        {message.activity && !message.text && (
          <p className="animate-pulse text-sm text-app-muted">{activity}…</p>
        )}
        {message.text && <AiMarkdown text={message.text} />}
        {message.status !== 'streaming' && message.text && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-app-muted">
            <button
              type="button"
              onClick={copy}
              aria-label={t('assistant.copy')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                copied
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-app-muted hover:bg-white/5 hover:text-app-secondary'
              }`}
            >
              {copied ? <FiCheck /> : <FiCopy />}
              <span>{copied ? t('assistant.copied') : t('assistant.copy')}</span>
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/5 hover:text-app-secondary"
              >
                <FiRefreshCw />
                {t('assistant.retry')}
              </button>
            )}
            {onRetryAlt && altModel && (
              <button
                type="button"
                onClick={onRetryAlt}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/5 hover:text-app-secondary"
              >
                <FiRefreshCw />
                {t('assistant.retryWith').replace(
                  '{model}',
                  modelLabel(altModel) || altModel
                )}
              </button>
            )}
            {message.status === 'stopped' && (
              <span className="px-1.5">{t('assistant.stopped')}</span>
            )}
            {!!message.tokens && (
              <span className="px-1.5">
                {formatTokens(message.tokens)} {t('assistant.tokens')}
              </span>
            )}
            {modelLabel(message.model) && (
              <span className="px-1.5">{modelLabel(message.model)}</span>
            )}
          </div>
        )}
        {message.status === 'done' && message.prefill && onAddPrefill && (
          <button
            type="button"
            onClick={onAddPrefill}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-app-accent)]/40 bg-[var(--color-app-accent)]/10 px-3.5 py-2 text-[0.8rem] font-medium text-[var(--color-app-accent)] transition-colors hover:bg-[var(--color-app-accent)]/20"
          >
            <FiPlus />
            {t('assistant.addWithCategory')}
          </button>
        )}
        {message.status === 'done' &&
          !!message.followUps?.length &&
          onFollowUp && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.followUps.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onFollowUp(question)}
                  className="rounded-full border border-white/12 bg-white/[0.07] px-3.5 py-2 text-left text-[0.8rem] leading-snug text-app-primary transition-colors hover:border-[var(--color-app-accent)] hover:text-[var(--color-app-accent)]"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

const Chat: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const { t } = useLocalization();
  const { messages, busy, send, retry, stop, reset, hasData, loans } =
    useAiChat(apiKey);
  const [input, setInput] = useState('');
  const raw = useExpenseRaw();
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[] | null>(
    null
  );
  const [browsingSuggestions, setBrowsingSuggestions] = useState(false);
  const seenSuggestions = useRef(new Set<string>());
  const shuffleSuggestions = useCallback(() => {
    const next = pickSuggestedPrompts(
      [
        ...buildDataPrompts(getAiItems(raw || []), getShareDescriptions()),
        ...buildLoanPrompts(loans),
      ],
      6,
      seenSuggestions.current
    );
    seenSuggestions.current = next.seen;
    setSuggestions(next.prompts);
  }, [raw, loans]);

  const sourceKey = `${raw?.length ? 'expenses' : ''}:${loans.length}`;
  const pickedFor = useRef('');
  useEffect(() => {
    if (!raw?.length && !loans.length) return;
    if (pickedFor.current === sourceKey) return;
    pickedFor.current = sourceKey;
    seenSuggestions.current = new Set();
    shuffleSuggestions();
  }, [sourceKey, raw, loans, shuffleSuggestions]);

  const online = useOnline();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pendingPrompt = (location.state as { prompt?: string } | undefined)
    ?.prompt;
  const sentPromptRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !pendingPrompt ||
      !hasData ||
      !online ||
      busy ||
      sentPromptRef.current === pendingPrompt
    ) {
      return;
    }
    sentPromptRef.current = pendingPrompt;
    navigate({ to: location.pathname, replace: true, state: {} });
    send(pendingPrompt);
  }, [pendingPrompt, hasData, online, busy, navigate, location.pathname, send]);

  const lastMessage = messages[messages.length - 1];
  const lastText = lastMessage?.text;
  const lastFollowUps = lastMessage?.followUps?.length;
  useEffect(() => {
    if (browsingSuggestions) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastText, lastFollowUps, browsingSuggestions]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const speechPrefixRef = useRef('');
  // A final recognition result can arrive after send and would refill the box.
  const acceptSpeechRef = useRef(true);
  const speech = useSpeechInput((text) => {
    if (!acceptSpeechRef.current) return;
    setInput(
      speechPrefixRef.current ? `${speechPrefixRef.current} ${text}` : text
    );
  });

  const toggleSpeech = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    acceptSpeechRef.current = true;
    speechPrefixRef.current = input.trim();
    speech.start();
  };

  const canSend = online && hasData && !busy && input.trim().length > 0;

  const submit = (text = input) => {
    if (!online || !hasData || busy || !text.trim()) return;
    acceptSpeechRef.current = false;
    speechPrefixRef.current = '';
    speech.stop();
    setBrowsingSuggestions(false);
    send(text);
    setInput('');
  };

  const placeholder = !online
    ? t('assistant.offline')
    : !hasData
      ? t('assistant.loadingData')
      : speech.listening
        ? t('assistant.listening')
        : t('assistant.placeholder');

  const suggestionList = suggestions && (
    <>
      <div className="mt-4 flex w-full flex-col gap-2">
        {suggestions.map((prompt) => {
          const kind = PROMPT_KIND[prompt.kind];
          const KindIcon = kind.icon;
          return (
            <button
              key={prompt.text}
              type="button"
              disabled={!online || !hasData || busy}
              onClick={() => submit(prompt.text)}
              className="flex w-full flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05] active:bg-white/[0.07] disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-app-accent)]">
                <KindIcon className="text-sm" />
                {t(kind.label)}
              </span>
              <span className="text-sm leading-snug text-app-primary">
                {prompt.text}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={shuffleSuggestions}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-app-secondary hover:bg-white/[0.04]"
      >
        <FiShuffle />
        {t('assistant.moreIdeas')}
      </button>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-3 md:px-6 lg:px-8">
          <p className="pt-1 text-sm leading-relaxed text-app-muted">
            {t('assistant.empty')}
          </p>
          {suggestionList}
        </div>
      ) : browsingSuggestions ? (
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-3 md:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setBrowsingSuggestions(false)}
            className="inline-flex items-center gap-1 text-sm text-app-secondary hover:text-app-primary"
          >
            <FiChevronLeft />
            {t('assistant.backToChat')}
          </button>
          {suggestionList}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6 lg:px-8">
          {messages.map((message, index) => {
            const latest = index === messages.length - 1;
            const canRetry =
              latest &&
              (message.status === 'error' || message.status === 'stopped') &&
              online &&
              !busy;
            const altModel = canRetry
              ? nextChatModel(message.failedModel || message.model)
              : null;
            return message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-[var(--color-app-accent)]/15 px-3.5 py-2 text-sm text-app-primary">
                  {message.text}
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onRetry={canRetry ? () => retry(message.id) : undefined}
                onRetryAlt={
                  altModel ? () => retry(message.id, altModel) : undefined
                }
                onFollowUp={latest && !busy ? submit : undefined}
                onAddPrefill={
                  message.prefill
                    ? () =>
                        navigate({
                          to: '/expenses',
                          state: { prefill: message.prefill },
                        })
                    : undefined
                }
                altModel={altModel}
              />
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-2 md:px-6 lg:px-8">
        {messages.length > 0 && !browsingSuggestions && (
          <button
            type="button"
            onClick={() => setBrowsingSuggestions(true)}
            className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-app-secondary hover:bg-white/[0.04]"
          >
            <FiList />
            {t('assistant.showQuestions')}
          </button>
        )}
        <form
          className="flex items-end gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] py-1.5 pr-1.5 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label={t('assistant.newChat')}
              title={t('assistant.newChat')}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-muted hover:bg-white/5 hover:text-app-secondary"
            >
              <FiRotateCcw />
            </button>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder={placeholder}
            disabled={!online || !hasData}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            aria-label={t('assistant.message')}
            className="max-h-[140px] min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-app-primary outline-none placeholder:text-app-muted disabled:opacity-60"
          />
          {speech.supported && (
            <button
              type="button"
              onClick={toggleSpeech}
              disabled={!online || !hasData}
              aria-label={
                speech.listening
                  ? t('assistant.stopVoice')
                  : t('assistant.voice')
              }
              aria-pressed={speech.listening}
              title={
                speech.listening
                  ? t('assistant.stopVoice')
                  : t('assistant.voice')
              }
              className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
                speech.listening
                  ? 'bg-red-500/15 text-red-400'
                  : 'text-app-muted hover:bg-white/5 hover:text-app-secondary'
              }`}
            >
              {speech.listening ? <FiMicOff /> : <FiMic />}
            </button>
          )}
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label={t('assistant.stop')}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-app-accent)] text-[var(--color-btn-on-accent)]"
            >
              <FiSquare />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={t('assistant.send')}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-app-accent)] text-[var(--color-btn-on-accent)] disabled:opacity-40"
            >
              <FiArrowUp />
            </button>
          )}
        </form>
        <p
          className={`mt-2 text-center text-xs ${speech.error ? 'text-red-400' : 'text-app-muted'}`}
          role={speech.error ? 'alert' : undefined}
        >
          {speech.error || t('assistant.disclaimer')}
        </p>
      </div>
    </div>
  );
};

const Assistant = () => {
  const { t } = useLocalization();
  const { data: expenses, dataDispatch: expenseDispatch } = useExpenseData();
  const { data, dataDispatch } = useLoan();
  const apiClient = useApiClient();
  const { apiKey, status } = useAiApiKey();

  const loansFetched = useRef(false);
  useEffect(() => {
    if (loansFetched.current || data.loans || !apiClient) return;
    loansFetched.current = true;
    fetchLoans(apiClient, dataDispatch);
  }, [data.loans, apiClient, dataDispatch]);

  useEffect(() => {
    if (!apiClient || !expenses.loading) return;
    fetchExpenses(apiClient, expenseDispatch);
  }, [apiClient, expenses.loading, expenseDispatch]);

  return (
    <div className="absolute inset-0 flex w-full flex-col pb-[calc(64px+env(safe-area-inset-bottom,0))] min-[1024px]:right-auto min-[1024px]:left-1/2 min-[1024px]:w-full min-[1024px]:max-w-[1100px] min-[1024px]:-translate-x-1/2">
      <h1 className="shrink-0 px-4 pt-4 text-2xl font-semibold tracking-tight text-app-primary md:px-6 lg:px-8">
        {t('assistant.title')}
      </h1>
      {status === 'loading' && <LoadingSpinner />}
      {status === 'missing' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]">
            <FiKey className="text-[26px]" />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-app-secondary">
            {t('assistant.needKey')}
          </p>
          <Link
            to="/expenses/user"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--color-app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-btn-on-accent)]"
          >
            {t('assistant.openProfile')}
          </Link>
        </div>
      )}
      {status === 'ready' && <Chat apiKey={apiKey} />}
    </div>
  );
};

export default Assistant;
