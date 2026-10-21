import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { FiMic, FiMicOff, FiRefreshCw } from 'react-icons/fi';
import VaulDrawer from '@shared/components/VaulDrawer';
import FormField from '@shared/components/Common/FormField';
import { Loader } from '@shared/components/Common';
import { useAuthState } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { getCategories, incomeSuggestions, notificationType } from '@shared/utils/constants';
import TagChips from '@shared/components/Common/TagChips';
import { normalizeTag } from '@shared/hooks/useTags';
import { addTagToText, getSuggestionTranslationKey, removeTagFromText } from '@shared/utils/utils';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { AiError, describeAiError } from '../../../../ai/client';
import { AI_MODELS, modelLabel, nextModel } from '../../../../ai/config';
import { useAiApiKey } from '../../../../ai/hooks/useAiApiKey';
import { useSpeechInput } from '../../../../ai/hooks/useSpeechInput';
import { localToday } from '../../../../ai/data';
import {
  VoiceMoneyEntry,
  parseVoiceEntries,
  tagsFor,
} from '../../../../ai/parseVoiceEntry';
import { saveMoneyEntries } from '../../api/saveMoneyEntries';

type Phase = 'closed' | 'listening' | 'parsing' | 'review' | 'error' | 'needKey';

const RETRY_BUTTON_CLASS =
  'inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-base font-semibold text-app-primary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5';

const buttonPosition = (stacked: boolean) =>
  [
    'fixed z-[1000] flex cursor-pointer select-none items-center justify-center rounded-full border-0',
    'text-[var(--color-btn-on-accent)] shadow-[0_4px_16px_var(--color-app-accent-shadow),0_0_32px_var(--color-app-glow)]',
    'right-5 h-14 w-14 md:right-4 md:h-[52px] md:w-[52px]',
    'max-[480px]:right-3 max-[480px]:h-12 max-[480px]:w-12',
    'min-[1024px]:right-[calc(50%-550px+1rem)]',
    '[&_svg]:pointer-events-none [&_svg]:h-6 [&_svg]:w-6 md:[&_svg]:h-[22px] md:[&_svg]:w-[22px]',
    stacked
      ? 'bottom-[calc(168px+env(safe-area-inset-bottom))] md:bottom-[154px] max-[480px]:bottom-[calc(140px+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(100px+env(safe-area-inset-bottom))] md:bottom-[90px] max-[480px]:bottom-[calc(80px+env(safe-area-inset-bottom))]',
  ].join(' ');

const VoiceEntryButton = ({
  stacked,
  kind,
}: {
  stacked: boolean;
  kind: 'expense' | 'income';
}) => {
  const { t } = useLocalization();
  const { token, currency } = useAuthState();
  const { dataDispatch } = useExpenseData();
  const showNotification = useNotification();
  const { apiKey } = useAiApiKey();
  const categories = getCategories();
  const [phase, setPhase] = useState<Phase>('closed');
  const [transcript, setTranscript] = useState('');
  const [drafts, setDrafts] = useState<VoiceMoneyEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedModel, setFailedModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const transcriptRef = useRef('');
  const heardRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const speech = useSpeechInput((text) => {
    transcriptRef.current = text;
    setTranscript(text);
  }, 1000);

  const beginListening = () => {
    heardRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    setFailedModel(null);
    setPhase('listening');
    speech.start();
  };

  useEffect(() => {
    if (speech.listening) heardRef.current = true;
    if (
      speech.listening ||
      speech.error ||
      !heardRef.current ||
      phaseRef.current !== 'listening'
    ) {
      return;
    }
    heardRef.current = false;
    const text = transcriptRef.current.trim();
    if (!text) {
      setFailedModel(null);
      setErrorMessage(t('home.voiceEmpty'));
      setPhase('error');
      return;
    }
    void understand(text);
  }, [speech.listening, speech.error, t]);

  useEffect(() => {
    if (!speech.error || phaseRef.current !== 'listening') return;
    setFailedModel(null);
    setErrorMessage(speech.error);
    setPhase('error');
  }, [speech.error]);

  const understand = async (text: string, preferModel?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    phaseRef.current = 'parsing';
    setFailedModel(null);
    setPhase('parsing');
    try {
      const items = await parseVoiceEntries(
        apiKey,
        text,
        { today: localToday(), currency: currency || 'MDL', kind },
        controller.signal,
        preferModel
      );
      if (controller.signal.aborted || phaseRef.current !== 'parsing') return;
      if (!items.length) {
        setErrorMessage(t('home.voiceEmpty'));
        setPhase('error');
        return;
      }
      setDrafts(items);
      setPhase('review');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError' || controller.signal.aborted) return;
      setFailedModel(
        (error instanceof AiError && error.model) ||
          preferModel ||
          AI_MODELS.lite[0]
      );
      setErrorMessage(describeAiError(error));
      setPhase('error');
    }
  };

  const open = () => {
    if (!speech.supported) {
      showNotification(t('home.voiceUnsupported'), notificationType.ERROR);
      return;
    }
    if (!apiKey) {
      setPhase('needKey');
      return;
    }
    beginListening();
  };

  const close = () => {
    phaseRef.current = 'closed';
    abortRef.current?.abort();
    speech.stop();
    setPhase('closed');
    setDrafts([]);
    setFailedModel(null);
    setSaving(false);
  };

  const descriptionWithTags = (description: string, tags: string[]) =>
    tags.reduce(
      (text, tag) => addTagToText(text, tag),
      description.replace(/#[\w-]+/g, ' ').replace(/\s+/g, ' ').trim()
    );

  const updateDraft = (index: number, patch: Partial<VoiceMoneyEntry>) => {
    setDrafts((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  };

  const canSave =
    drafts.length > 0 &&
    drafts.every(
      (entry) =>
        Number(entry.amount) > 0 &&
        entry.description.trim() &&
        entry.date &&
        (entry.kind === 'income' || entry.category)
    );

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const prepared = drafts.map((entry) => ({
        ...entry,
        description: entry.tags.reduce(
          (text, tag) => addTagToText(text, tag),
          entry.description.replace(/#[\w-]+/g, ' ').replace(/\s+/g, ' ').trim()
        ),
      }));
      const { offline } = await saveMoneyEntries(prepared, token, dataDispatch);
      const message = offline
        ? t('notification.savedOffline')
        : drafts.length === 1
          ? t(
              drafts[0].kind === 'income'
                ? 'notification.incomeAdded'
                : 'notification.transactionAdded'
            )
          : `${drafts.length} ${t('home.voiceSavedMany')}`;
      showNotification(message, notificationType.SUCCESS);
      close();
    } catch {
      showNotification(t('error.unknown'), notificationType.ERROR);
      setSaving(false);
    }
  };

  const heard = transcript.trim();
  const altModel =
    failedModel && heard ? nextModel('lite', failedModel) : null;
  const listening = phase === 'listening';

  const retrySame = () => {
    const text = transcriptRef.current.trim();
    if (failedModel && text) {
      void understand(text);
      return;
    }
    beginListening();
  };

  return (
    <>
      <button
        type="button"
        className={`${buttonPosition(stacked)} ${
          listening
            ? 'animate-pulse bg-red-500'
            : 'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)]'
        }`}
        onClick={() => (phase === 'closed' ? open() : close())}
        aria-pressed={phase !== 'closed'}
        aria-label={t('home.voiceAdd')}
        title={t('home.voiceAdd')}
      >
        {listening ? <FiMicOff /> : <FiMic />}
      </button>

      <VaulDrawer
        show={phase !== 'closed'}
        onClose={(event) => {
          event?.preventDefault();
          close();
        }}
        title={phase === 'review' ? t('home.voiceReview') : t('home.voiceAdd')}
        footer={
          phase === 'review' ? (
            <button
              type="button"
              className={BTN_SUBMIT_CLASS}
              disabled={!canSave || saving}
              onClick={save}
            >
              {saving ? <Loader variant="on-button" /> : t('common.save')}
            </button>
          ) : phase === 'listening' ? (
            <button
              type="button"
              className={BTN_SUBMIT_CLASS}
              onClick={() => speech.stop()}
              disabled={!transcript.trim()}
            >
              {t('common.add')}
            </button>
          ) : phase === 'error' ? (
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className={BTN_SUBMIT_CLASS}
                onClick={retrySame}
                disabled={!!failedModel && !online}
              >
                <FiRefreshCw />
                {t('assistant.retry')}
              </button>
              {altModel && (
                <button
                  type="button"
                  className={RETRY_BUTTON_CLASS}
                  onClick={() => understand(transcriptRef.current.trim(), altModel)}
                  disabled={!online}
                >
                  <FiRefreshCw />
                  {t('assistant.retryWith').replace(
                    '{model}',
                    modelLabel(altModel) || altModel
                  )}
                </button>
              )}
            </div>
          ) : null
        }
      >
        {listening && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-app-muted">{t('home.voiceListening')}</p>
            <p className="min-h-12 text-lg leading-snug text-app-primary">
              {transcript || t(kind === 'income' ? 'income.voiceHint' : 'home.voiceHint')}
            </p>
          </div>
        )}

        {phase === 'parsing' && (
          <p className="animate-pulse py-8 text-center text-sm text-app-muted">
            {t('home.voiceUnderstanding')}
          </p>
        )}

        {phase === 'needKey' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm leading-relaxed text-app-secondary">{t('assistant.needKey')}</p>
            <Link
              to="/expenses/user"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-btn-on-accent)]"
              onClick={close}
            >
              {t('assistant.openProfile')}
            </Link>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-3 py-4 text-center">
            {failedModel && heard && (
              <p className="text-base leading-snug text-app-primary">{heard}</p>
            )}
            <p className="text-sm leading-relaxed text-app-secondary">{errorMessage}</p>
          </div>
        )}

        {phase === 'review' && (
          <div className="flex flex-col gap-4">
            {heard && (
              <p className="m-0 text-sm leading-snug text-app-muted">{heard}</p>
            )}
            {drafts.map((entry, index) => (
              <div
                key={`${entry.description}-${index}`}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <FormField
                  name={`amount-${index}`}
                  type="number"
                  label={t('transactionForm.amount')}
                  value={entry.amount}
                  min={0}
                  step={0.01}
                  onChange={(event) => updateDraft(index, { amount: event.target.value })}
                />
                <FormField
                  name={`description-${index}`}
                  type="text"
                  label={t('transactionForm.description')}
                  value={entry.description}
                  onChange={(event) => updateDraft(index, { description: event.target.value })}
                />
                {entry.kind === 'expense' && (
                  <div className="form-group">
                    <label htmlFor={`category-${index}`}>{t('transactionForm.category')}</label>
                    <div className="input-wrapper">
                      <select
                        id={`category-${index}`}
                        className="form-input"
                        value={entry.category}
                        onChange={(event) => {
                          const category = event.target.value;
                          const allowed = new Set(tagsFor('expense', category).map(normalizeTag));
                          const tags = entry.tags.filter((tag) => allowed.has(tag));
                          updateDraft(index, {
                            category,
                            tags,
                            description: descriptionWithTags(entry.description, tags),
                          });
                        }}
                      >
                        {categories.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <TagChips
                  suggestions={
                    entry.kind === 'income' ? incomeSuggestions : tagsFor('expense', entry.category)
                  }
                  selectedTags={entry.tags}
                  normalizeTag={normalizeTag}
                  isTagSelected={(tag) => entry.tags.includes(tag)}
                  onTagClick={(tag) => {
                    const selected = entry.tags.includes(tag);
                    const tags = selected
                      ? entry.tags.filter((item) => item !== tag)
                      : [...entry.tags, tag];
                    updateDraft(index, {
                      tags,
                      description: selected
                        ? removeTagFromText(entry.description, tag)
                        : addTagToText(entry.description, tag),
                    });
                  }}
                  getTagLabel={(suggestion) => {
                    if (entry.kind === 'income') {
                      const label = t(`income.tags.${suggestion}`);
                      return label === `income.tags.${suggestion}` ? suggestion : label;
                    }
                    const key = getSuggestionTranslationKey(suggestion, entry.category);
                    const label = t(key);
                    return label === key ? suggestion : label;
                  }}
                  translationKey="suggestions.title"
                />
                <FormField
                  name={`date-${index}`}
                  type="date"
                  label={t('transactionForm.date')}
                  value={entry.date}
                  max={localToday()}
                  onChange={(event) => updateDraft(index, { date: event.target.value })}
                />
                {drafts.length > 1 && (
                  <button
                    type="button"
                    className="self-start text-sm text-app-muted"
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                  >
                    {t('home.voiceRemove')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </VaulDrawer>
    </>
  );
};

export default VoiceEntryButton;
