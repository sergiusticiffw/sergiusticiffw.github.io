import { LuSparkles } from 'react-icons/lu';
import React, { useEffect, useState } from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import { useNotification } from '@shared/context';
import { useLocalization } from '@shared/context/localization';
import { notificationType } from '@shared/utils/constants';
import { Switch } from '@shared/ui';
import { AI_LANGUAGES, modelLabel } from '../../../ai/config';
import { maskApiKey } from '../../../ai/apiKey';
import { describeAiError, testApiKey } from '../../../ai/client';
import { isAiDebugEnabled, setAiDebugEnabled } from '../../../ai/debug';
import { useAiAccess } from '../../../ai/hooks/useAiAccess';
import { getSessionAiStats } from '../../../ai/sessionStats';
import {
  PREFS_APPLIED_EVENT,
  pullPreferencesFromProfile,
} from '../../profile/preferencesSync';
import {
  getAiLanguage,
  getShareDescriptions,
  setAiLanguage,
  setShareDescriptions,
} from '../../../ai/storage';

const fieldClass =
  'w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5';

const secondaryBtn =
  'rounded-lg border border-white/10 px-3 py-2 text-sm text-app-secondary hover:bg-white/5 disabled:opacity-50';

type KeyProvider = 'gemini' | 'openrouter';

const KeyBlock = ({
  provider,
  label,
  pasteLabel,
  hint,
  hintHref,
  hintLinkText,
  apiKey,
  synced,
  onSave,
  onRemove,
}: {
  provider: KeyProvider;
  label: string;
  pasteLabel: string;
  hint: string;
  hintHref: string;
  hintLinkText: string;
  apiKey: string;
  synced?: boolean;
  onSave: (key: string) => Promise<'synced' | 'local'>;
  onRemove: () => Promise<'synced' | 'local'>;
}) => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const notifySaved = (result: 'synced' | 'local', removed = false) => {
    if (removed) {
      showNotification(
        result === 'synced'
          ? t(
              provider === 'gemini'
                ? 'profile.aiRemoved'
                : 'profile.aiOrRemoved'
            )
          : t(
              provider === 'gemini'
                ? 'profile.aiRemovedLocal'
                : 'profile.aiOrRemovedLocal'
            ),
        result === 'synced' ? notificationType.SUCCESS : notificationType.ERROR
      );
      return;
    }
    showNotification(
      result === 'synced'
        ? t(provider === 'gemini' ? 'profile.aiSaved' : 'profile.aiOrSaved')
        : t(
            provider === 'gemini'
              ? 'profile.aiSavedLocal'
              : 'profile.aiOrSavedLocal'
          ),
      result === 'synced' ? notificationType.SUCCESS : notificationType.ERROR
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    try {
      await testApiKey(key, provider);
    } catch (error) {
      showNotification(describeAiError(error), notificationType.ERROR);
      setBusy(false);
      return;
    }
    const result = await onSave(key);
    setDraft('');
    setEditing(false);
    notifySaved(result);
    setBusy(false);
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const model = await testApiKey(apiKey, provider);
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
    const result = await onRemove();
    notifySaved(result, true);
    setBusy(false);
  };

  return (
    <div className="mb-4 border-b border-white/[0.06] pb-4 last:mb-0 last:border-0 last:pb-0">
      <p className="mb-2 text-sm font-medium text-app-primary">{label}</p>
      {apiKey && !editing ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-app-secondary">
              {t('profile.aiKeyMasked')}
            </span>
            <code className="text-xs text-app-muted">{maskApiKey(apiKey)}</code>
          </div>
          {synced === false && (
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
              placeholder={pasteLabel}
              autoComplete="off"
              spellCheck={false}
              aria-label={label}
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
            {hint}{' '}
            <a
              href={hintHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-app-accent)] underline"
            >
              {hintLinkText}
            </a>
          </p>
        </form>
      )}
    </div>
  );
};

const AiSettings = () => {
  const { t } = useLocalization();
  const {
    geminiApiKey,
    geminiStatus,
    geminiSynced,
    saveGemini,
    openrouterApiKey,
    openrouterSynced,
    saveOpenrouter,
  } = useAiAccess();
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState(getShareDescriptions);
  const [language, setLanguage] = useState(getAiLanguage);
  const [debug, setDebug] = useState(isAiDebugEnabled);
  // Usage from other devices arrives with the synced preferences.
  const [, setStatsVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setStatsVersion((version) => version + 1);
    window.addEventListener(PREFS_APPLIED_EVENT, refresh);
    void pullPreferencesFromProfile();
    return () => window.removeEventListener(PREFS_APPLIED_EVENT, refresh);
  }, []);
  const stats = getSessionAiStats();
  const lastModel =
    stats.usage.lastModel || stats.lastFailed?.model || null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden md:rounded-[10px] transition-colors active:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-2.5 py-5 px-5 md:py-4 md:px-4 text-left bg-transparent border-none cursor-pointer [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:shrink-0"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
          <LuSparkles />
          <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
            {t('profile.aiTitle')}
          </h3>
        </div>
        {open ? (
          <FiChevronUp className="text-app-muted" aria-hidden />
        ) : (
          <FiChevronDown className="text-app-muted" aria-hidden />
        )}
      </button>

      {open && (
      <div className="px-5 pb-5 pt-0 md:px-4 md:pb-4 border-t border-white/[0.06]">
      <div className="pt-4 md:pt-3">
      <p className="mb-4 text-xs leading-relaxed text-app-muted">
        {t('profile.aiCascadeKeys')}
      </p>

      {geminiStatus === 'loading' ? (
        <p className="text-sm text-app-muted">{t('common.loading')}</p>
      ) : (
        <>
          <KeyBlock
            provider="gemini"
            label={t('profile.aiKey')}
            pasteLabel={t('profile.aiPaste')}
            hint={t('profile.aiHint')}
            hintHref="https://aistudio.google.com/apikey"
            hintLinkText="aistudio.google.com/apikey"
            apiKey={geminiApiKey}
            synced={geminiSynced}
            onSave={saveGemini}
            onRemove={() => saveGemini('')}
          />
          <KeyBlock
            provider="openrouter"
            label={t('profile.aiOrKey')}
            pasteLabel={t('profile.aiOrPaste')}
            hint={t('profile.aiOrHint')}
            hintHref="https://openrouter.ai/keys"
            hintLinkText="openrouter.ai/keys"
            apiKey={openrouterApiKey}
            synced={openrouterSynced}
            onSave={saveOpenrouter}
            onRemove={() => saveOpenrouter('')}
          />
        </>
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
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span id="ai-debug-label" className="text-sm text-app-secondary">
          {t('profile.aiDebug')}
        </span>
        <Switch
          checked={debug}
          aria-labelledby="ai-debug-label"
          onCheckedChange={(checked) => {
            setAiDebugEnabled(checked);
            setDebug(checked);
          }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-app-muted">
        {t('profile.aiDebugHint')}
        {debug ? ` · ${t('profile.aiDebugOn')}` : ''}
      </p>

      <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-3 text-sm">
        <p className="m-0 text-xs leading-relaxed text-app-muted">
          {t('profile.aiStatsHint')}
        </p>
        <Stat label={t('profile.aiQuestions')} value={formatCount(stats.usage.questions)} />
        <Stat label={t('profile.aiRequests')} value={formatCount(stats.usage.requests)} />
        <Stat label={t('profile.aiTokens')} value={formatCount(stats.usage.tokens)} />
        <Stat
          label={t('profile.aiLastModel')}
          value={lastModel ? modelLabel(lastModel) || lastModel : t('profile.aiNotUsed')}
        />
        <Stat
          label={t('profile.aiReset')}
          value={`${formatTime(stats.resetAt)} (${t('profile.aiIn').replace(
            '{time}',
            formatDuration(Math.max(0, Math.round((stats.resetAt - Date.now()) / 1000)))
          )})`}
        />
        {stats.lastFailed && (
          <p className="m-0 text-xs leading-relaxed text-app-muted">
            {t('profile.aiNextModel')
              .replace('{model}', modelLabel(stats.lastFailed.model) || stats.lastFailed.model)
              .replace('{time}', formatTime(stats.lastFailed.until))}
          </p>
        )}
        {stats.paused.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-xs font-semibold text-app-secondary">
              {t('profile.aiLimits')}
            </span>
            {stats.paused.map((limit) => (
              <p key={limit.model} className="m-0 text-xs leading-relaxed text-app-muted">
                <span className="font-semibold text-amber-300">
                  {modelLabel(limit.model)}
                </span>
                {' · '}
                {limit.daily ? t('profile.aiDailyLimit') : t('profile.aiMinuteLimit')}
                {limit.limit ? ` (${formatCount(limit.limit)})` : ''}
                {' · '}
                {t('profile.aiPausedUntil').replace('{time}', formatTime(limit.until))}
              </p>
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs text-app-muted">{t('profile.aiNoPause')}</p>
        )}
      </div>
      </div>
      </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <p className="m-0">
    <span className="text-app-muted">{label}: </span>
    <span className="text-app-secondary">{value}</span>
  </p>
);

const formatCount = (value: number) => value.toLocaleString();

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
