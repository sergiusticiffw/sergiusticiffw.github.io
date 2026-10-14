import React, { useState } from 'react';
import { FiEye, FiEyeOff, FiZap } from 'react-icons/fi';
import { useNotification } from '@shared/context';
import { useLocalization } from '@shared/context/localization';
import { notificationType } from '@shared/utils/constants';
import { Switch } from '@shared/ui';
import { AI_LANGUAGES, AI_MODELS, modelLabel } from '../../../ai/config';
import { maskApiKey } from '../../../ai/apiKey';
import { describeAiError, testApiKey } from '../../../ai/client';
import { useAiApiKey } from '../../../ai/hooks/useAiApiKey';
import {
  effectiveCooldownUntil,
  getAiLanguage,
  getAiUsage,
  getModelLimitLog,
  getShareDescriptions,
  setAiLanguage,
  setShareDescriptions,
} from '../../../ai/storage';

const fieldClass =
  'w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5';

const secondaryBtn =
  'rounded-lg border border-white/10 px-3 py-2 text-sm text-app-secondary hover:bg-white/5 disabled:opacity-50';

const AiSettings = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { apiKey, status, save, synced } = useAiApiKey();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(getShareDescriptions);
  const [language, setLanguage] = useState(getAiLanguage);
  const usage = getAiUsage();
  const limitLog = getModelLimitLog();
  const limitedModels = AI_MODELS.chat
    .filter((model) => limitLog[model])
    .map((model) => [model, limitLog[model]] as const);

  const notifySaved = (result: 'synced' | 'local', removed = false) => {
    if (removed) {
      showNotification(
        result === 'synced'
          ? t('profile.aiRemoved')
          : t('profile.aiRemovedLocal'),
        result === 'synced' ? notificationType.SUCCESS : notificationType.ERROR
      );
      return;
    }
    showNotification(
      result === 'synced' ? t('profile.aiSaved') : t('profile.aiSavedLocal'),
      result === 'synced' ? notificationType.SUCCESS : notificationType.ERROR
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    try {
      await testApiKey(key);
    } catch (error) {
      showNotification(describeAiError(error), notificationType.ERROR);
      setBusy(false);
      return;
    }
    const result = await save(key);
    setDraft('');
    setEditing(false);
    notifySaved(result);
    setBusy(false);
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const model = await testApiKey(apiKey);
      showNotification(
        t('profile.aiTestOk').replace('{model}', model),
        notificationType.SUCCESS
      );
    } catch (error) {
      showNotification(describeAiError(error), notificationType.ERROR);
    }
    setBusy(false);
  };

  const handleRemove = async () => {
    setBusy(true);
    const result = await save('');
    notifySaved(result, true);
    setBusy(false);
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px]">
      <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
        <FiZap />
        <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
          {t('profile.aiTitle')}
        </h3>
      </div>

      {status === 'loading' ? (
        <p className="text-sm text-app-muted">{t('common.loading')}</p>
      ) : apiKey && !editing ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-app-secondary">
              {t('profile.aiKey')}
            </span>
            <code className="text-xs text-app-muted">{maskApiKey(apiKey)}</code>
          </div>
          {!synced && (
            <p className="mb-3 text-xs text-amber-300/90">
              {t('profile.aiSavedLocal')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryBtn}
              onClick={handleTest}
              disabled={busy}
            >
              {t('profile.aiTest')}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              {t('profile.aiChange')}
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={handleRemove}
              disabled={busy}
            >
              {t('profile.aiRemove')}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSave}>
          <div className="relative mb-3">
            <input
              type={reveal ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('profile.aiPaste')}
              autoComplete="off"
              spellCheck={false}
              aria-label={t('profile.aiKey')}
              className={`${fieldClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              aria-label={reveal ? t('profile.aiHide') : t('profile.aiShow')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted"
            >
              {reveal ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-lg bg-[var(--color-app-accent)] px-3 py-2 text-sm font-medium text-[var(--color-btn-on-accent)] disabled:opacity-50"
            >
              {busy ? t('common.loading') : t('profile.aiSave')}
            </button>
            {editing && (
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                {t('profile.aiCancel')}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-app-muted">
            {t('profile.aiHint')}{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-app-accent)] underline"
            >
              aistudio.google.com/apikey
            </a>
          </p>
        </form>
      )}

      <label className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-app-secondary">
          {t('profile.aiLanguage')}
        </span>
        <select
          className="rounded-lg border border-app-subtle bg-app-surface px-3 py-2 text-sm text-app-primary outline-none"
          value={language}
          onChange={(e) => {
            setAiLanguage(e.target.value);
            setLanguage(e.target.value);
          }}
        >
          {AI_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span id="ai-share-label" className="text-sm text-app-secondary">
          {t('profile.aiShare')}
        </span>
        <Switch
          checked={share}
          aria-labelledby="ai-share-label"
          onCheckedChange={(checked) => {
            setShareDescriptions(checked);
            setShare(checked);
          }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-app-muted">
        {t('profile.aiShareHint')}
        {usage.requests > 0 &&
          ` ${t('profile.aiUsage')
            .replace('{requests}', String(usage.requests))
            .replace('{tokens}', usage.tokens.toLocaleString())}`}
      </p>

      {limitedModels.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
          <span className="text-xs font-semibold text-app-secondary">
            {t('profile.aiLimits')}
          </span>
          {limitedModels.map(([model, record]) => {
            const until = effectiveCooldownUntil(record);
            const paused = until > Date.now();
            return (
              <details
                key={model}
                className="text-xs leading-relaxed text-app-muted"
              >
                <summary className="cursor-pointer">
                  <span
                    className={
                      paused ? 'font-semibold text-amber-300' : undefined
                    }
                  >
                    {modelLabel(model)}
                  </span>
                  {' · '}
                  {record.daily
                    ? t('profile.aiDailyLimit')
                    : t('profile.aiMinuteLimit')}
                  {record.limit ? ` (${record.limit})` : ''}
                  {' · '}
                  {paused
                    ? t('profile.aiPausedUntil').replace(
                        '{time}',
                        formatTime(until)
                      )
                    : t('profile.aiLastHit').replace(
                        '{time}',
                        formatTime(record.at)
                      )}
                </summary>
                <dl className="mt-1.5 mb-1 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 rounded-lg bg-white/[0.04] px-2.5 py-2">
                  <dt className="text-app-muted/70">
                    {t('profile.aiReceived')}
                  </dt>
                  <dd className="m-0 break-words text-app-secondary">
                    {formatTime(record.at)}
                  </dd>
                  {record.retryAfterSeconds !== undefined && (
                    <>
                      <dt className="text-app-muted/70">
                        {t('profile.aiRetryAfter')}
                      </dt>
                      <dd className="m-0 text-app-secondary">
                        {formatDuration(record.retryAfterSeconds)}
                      </dd>
                    </>
                  )}
                  <dt className="text-app-muted/70">
                    {t('profile.aiPausedUntilLabel')}
                  </dt>
                  <dd className="m-0 text-app-secondary">
                    {formatTime(until)}
                  </dd>
                </dl>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
};

export default AiSettings;
