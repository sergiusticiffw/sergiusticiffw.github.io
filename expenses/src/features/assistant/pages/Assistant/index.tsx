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
import { fallbackModelLabel } from '../../../../ai/config';
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
  'Reviewing loans': 'assistant.reviewingLoans',
  'Reading the loan': 'assistant.readingLoan',
  'Looking up loan payments': 'assistant.loanPayments',
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
}> = ({ message, onRetry }) => {
  const { t } = useLocalization();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-app-muted">
            <button
              type="button"
              onClick={copy}
              aria-label={t('assistant.copy')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-white/5 hover:text-app-secondary"
            >
              {copied ? <FiCheck /> : <FiCopy />}
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/5 hover:text-app-secondary"
              >
                <FiRefreshCw />
                {t('assistant.retry')}
              </button>
            )}
            {message.status === 'stopped' && <span>{t('assistant.stopped')}</span>}
            {!!message.tokens && (
              <span>
                {formatTokens(message.tokens)} {t('assistant.tokens')}
              </span>
            )}
            {fallbackModelLabel(message.model) && (
              <span>
                {t('assistant.via')} {fallbackModelLabel(message.model)}
              </span>
            )}
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
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[] | null>(null);
  const [browsingSuggestions, setBrowsingSuggestions] = useState(false);
  const shuffleSuggestions = useCallback(
    () =>
      setSuggestions(
        pickSuggestedPrompts(
          [
            ...buildDataPrompts(getAiItems(raw || []), getShareDescriptions()),
            ...buildLoanPrompts(loans),
          ],
          6
        )
      ),
    [raw, loans]
  );

  const sourceKey = `${raw?.length ? 'expenses' : ''}:${loans.length}`;
  const pickedFor = useRef('');
  useEffect(() => {
    if (!raw?.length && !loans.length) return;
    if (pickedFor.current === sourceKey) return;
    pickedFor.current = sourceKey;
    shuffleSuggestions();
  }, [sourceKey, raw, loans, shuffleSuggestions]);

  const online = useOnline();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pendingPrompt = (location.state as { prompt?: string } | undefined)?.prompt;
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

  const lastText = messages[messages.length - 1]?.text;
  useEffect(() => {
    if (browsingSuggestions) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastText, browsingSuggestions]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const speechPrefixRef = useRef('');
  const speech = useSpeechInput((text) =>
    setInput(speechPrefixRef.current ? `${speechPrefixRef.current} ${text}` : text)
  );

  const toggleSpeech = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speechPrefixRef.current = input.trim();
    speech.start();
  };

  const canSend = online && hasData && !busy && input.trim().length > 0;

  const submit = (text = input) => {
    if (!online || !hasData || busy || !text.trim()) return;
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
              <span className="text-sm leading-snug text-app-primary">{prompt.text}</span>
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
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-3">
          <p className="pt-1 text-sm leading-relaxed text-app-muted">
            {t('assistant.empty')}
          </p>
          {suggestionList}
        </div>
      ) : browsingSuggestions ? (
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-3">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-[var(--color-app-accent)]/15 px-3.5 py-2 text-sm text-app-primary">
                  {message.text}
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onRetry={
                  index === messages.length - 1 &&
                  message.status === 'error' &&
                  online &&
                  !busy
                    ? () => retry(message.id)
                    : undefined
                }
              />
            )
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-2">
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
                speech.listening ? t('assistant.stopVoice') : t('assistant.voice')
              }
              aria-pressed={speech.listening}
              title={speech.listening ? t('assistant.stopVoice') : t('assistant.voice')}
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
    <div className="absolute inset-0 flex flex-col pb-[calc(64px+env(safe-area-inset-bottom,0))]">
      <h1 className="shrink-0 px-4 pt-4 text-2xl font-semibold tracking-tight text-app-primary">
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
      {status === 'ready' && (
        <Chat apiKey={apiKey} />
      )}
    </div>
  );
};

export default Assistant;
