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
import {
  AI_LANGUAGES,
  AI_RESPONSE_STYLES,
  modelLabel,
} from '../../../ai/config';
import { maskApiKey } from '../../../ai/apiKey';
import {
  AiError,
  describeAiError,
  testApiKey,
  type AiKeyProvider,
} from '../../../ai/client';
import { isAiDebugEnabled, setAiDebugEnabled } from '../../../ai/debug';
import {
  getAiPreferences,
  patchAiPreferences,
  type AiBehaviorPreferences,
} from '../../../ai/aiPreferences';
import { useAiAccess } from '../../../ai/hooks/useAiAccess';
import {
  getProviderSettings,
  providerLabel,
  setProviderOrder,
  updateProviderEntry,
  type AiProviderId,
  type AiProviderSettings,
} from '../../../ai/providerSettings';
import {
  getAiUsageMetrics,
  getSessionAiStats,
} from '../../../ai/sessionStats';
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

const sectionTitle =
  'mb-3 text-xs font-semibold uppercase tracking-wide text-app-muted';

type KeyProvider = AiKeyProvider;

const PROVIDER_META: Record<
  AiProviderId,
  {
    keyLabel: string;
    pasteLabel: string;
    hint: string;
    href: string;
    linkText: string;
  }
> = {
  gemini: {
    keyLabel: 'profile.aiKey',
    pasteLabel: 'profile.aiPaste',
    hint: 'profile.aiHint',
    href: 'https://aistudio.google.com/apikey',
    linkText: 'aistudio.google.com/apikey',
  },
  openrouter: {
    keyLabel: 'profile.aiOrKey',
    pasteLabel: 'profile.aiOrPaste',
    hint: 'profile.aiOrHint',
    href: 'https://openrouter.ai/keys',
    linkText: 'openrouter.ai/keys',
  },
};

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
    const localKey = removed
      ? 'profile.aiKeyRemovedLocal'
      : 'profile.aiKeySavedLocal';
    const okKey = removed ? 'profile.aiKeyRemoved' : 'profile.aiKeySaved';
    showNotification(
      result === 'synced'
        ? t(okKey).replace('{provider}', providerLabel(provider))
        : t(localKey).replace('{provider}', providerLabel(provider)),
      result === 'synced' ? notificationType.SUCCESS : notificationType.ERROR
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    let rateLimited = false;
    try {
      await testApiKey(key, provider);
    } catch (error) {
      // Rate limits are common on free tiers — still save a key that was not rejected.
      if (error instanceof AiError && error.kind === 'quota') {
        rateLimited = true;
      } else if (error instanceof AiError && error.kind === 'invalid_key') {
        showNotification(describeAiError(error), notificationType.ERROR);
        setBusy(false);
        return;
      } else {
        showNotification(describeAiError(error), notificationType.ERROR);
        setBusy(false);
        return;
      }
    }
    const result = await onSave(key);
    setDraft('');
    setEditing(false);
    notifySaved(result);
    if (rateLimited) {
      showNotification(
        t('profile.aiKeySavedRateLimited').replace(
          '{provider}',
          providerLabel(provider)
        ),
        notificationType.ERROR
      );
    }
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
      const base = describeAiError(error);
      const labeled = `${providerLabel(provider)}: ${base}`;
      showNotification(labeled, notificationType.ERROR);
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
    <div className="mb-3 border-b border-white/[0.06] pb-3 last:mb-0 last:border-0 last:pb-0">
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
              {t('profile.aiKeySavedLocal').replace(
                '{provider}',
                providerLabel(provider)
              )}
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

const NestedSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3 first:mt-0 first:border-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center justify-between gap-2 bg-transparent p-0 text-left"
        aria-expanded={open}
      >
        <span className={sectionTitle + ' mb-0'}>{title}</span>
        {open ? (
          <FiChevronUp className="text-app-muted" aria-hidden />
        ) : (
          <FiChevronDown className="text-app-muted" aria-hidden />
        )}
      </button>
      {open && children}
    </div>
  );
};

const ProvidersSection = ({
  settings,
  onChange,
  keys,
  synced,
  savers,
}: {
  settings: AiProviderSettings;
  onChange: (next: AiProviderSettings) => void;
  keys: Record<AiProviderId, string>;
  synced: Record<AiProviderId, boolean | undefined>;
  savers: Record<
    AiProviderId,
    {
      save: (key: string) => Promise<'synced' | 'local'>;
    }
  >;
}) => {
  const { t } = useLocalization();

  const moveProvider = (id: AiProviderId, direction: -1 | 1) => {
    const order = [...settings.order];
    const from = order.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = order[to];
    order[to] = order[from];
    order[from] = next;
    onChange(setProviderOrder(order));
  };

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-app-muted">
        {t('profile.aiCascadeKeys')}
      </p>

      <p className="mb-2 text-xs text-app-muted">{t('profile.aiProviderOrder')}</p>
      <ul className="mb-4 flex flex-col gap-2">
        {settings.order.map((id, index) => {
          const entry = settings.providers[id];
          const meta = PROVIDER_META[id];
          return (
            <li
              key={id}
              className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    className="rounded p-1 text-app-muted hover:bg-white/5 hover:text-app-primary disabled:opacity-30"
                    aria-label={t('profile.aiMoveUp')}
                    disabled={index === 0}
                    onClick={() => moveProvider(id, -1)}
                  >
                    <FiChevronUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-app-muted hover:bg-white/5 hover:text-app-primary disabled:opacity-30"
                    aria-label={t('profile.aiMoveDown')}
                    disabled={index === settings.order.length - 1}
                    onClick={() => moveProvider(id, 1)}
                  >
                    <FiChevronDown aria-hidden />
                  </button>
                </div>
                <span className="flex-1 text-sm font-medium text-app-primary">
                  {providerLabel(id)}
                  {index === 0 ? (
                    <span className="ml-2 text-xs font-normal text-app-muted">
                      ({t('profile.aiPrimary')})
                    </span>
                  ) : null}
                </span>
                <Switch
                  checked={entry.enabled}
                  aria-label={t('profile.aiProviderEnabled')}
                  onCheckedChange={(checked) =>
                    onChange(updateProviderEntry(id, { enabled: checked }))
                  }
                />
              </div>

              <KeyBlock
                provider={id}
                label={t(meta.keyLabel)}
                pasteLabel={t(meta.pasteLabel)}
                hint={t(meta.hint)}
                hintHref={meta.href}
                hintLinkText={meta.linkText}
                apiKey={keys[id] || ''}
                synced={synced[id]}
                onSave={savers[id].save}
                onRemove={() => savers[id].save('')}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const UsageSection = () => {
  const { t } = useLocalization();
  const metrics = getAiUsageMetrics('month');
  const today = getAiUsageMetrics('today');
  const stats = getSessionAiStats();
  const lastModel =
    stats.usage.lastModel || stats.lastFailed?.model || null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="m-0 text-xs leading-relaxed text-app-muted">
        {t('profile.aiUsageMonthHint')}
      </p>
      <Stat
        label={t('profile.aiTotalRequests')}
        value={formatCount(metrics.total)}
      />
      <Stat
        label={t('profile.aiFallbackRequests')}
        value={formatCount(metrics.fallbacks)}
      />
      <Stat
        label={t('profile.aiSuccessRate')}
        value={`${metrics.successRate.toFixed(1)}%`}
      />
      <Stat
        label={t('profile.aiAvgLatency')}
        value={
          metrics.avgLatencyMs
            ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s`
            : '—'
        }
      />
      <Stat label={t('profile.aiTokens')} value={formatCount(metrics.tokens)} />
      <Stat
        label={t('profile.aiRateLimitErrors')}
        value={formatCount(metrics.rateLimitErrors)}
      />
      <div className="pt-1">
        <p className="mb-1 text-xs font-semibold text-app-secondary">
          {t('profile.aiProviderDist')}
        </p>
        {Object.keys(metrics.byProvider).length === 0 ? (
          <p className="m-0 text-xs text-app-muted">{t('profile.aiNotUsed')}</p>
        ) : (
          Object.entries(metrics.byProvider).map(([id, count]) => (
            <Stat
              key={id}
              label={providerLabel(id as AiProviderId)}
              value={`${formatCount(count)} (${
                metrics.success
                  ? Math.round((count / metrics.success) * 100)
                  : 0
              }%)`}
            />
          ))
        )}
      </div>
      <div className="mt-2 border-t border-white/[0.06] pt-2">
        <p className="mb-1 text-xs font-semibold text-app-secondary">
          {t('profile.aiUsageToday')}
        </p>
        <Stat label={t('profile.aiQuestions')} value={formatCount(stats.usage.questions)} />
        <Stat label={t('profile.aiRequests')} value={formatCount(today.success || stats.usage.requests)} />
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
  );
};

const PreferencesSection = () => {
  const { t } = useLocalization();
  const [share, setShare] = useState(getShareDescriptions);
  const [language, setLanguage] = useState(getAiLanguage);
  const [prefs, setPrefs] = useState<AiBehaviorPreferences>(getAiPreferences);
  const [debug, setDebug] = useState(isAiDebugEnabled);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3">
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

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-app-secondary">
          {t('profile.aiResponseStyle')}
        </span>
        <select
          className="rounded-lg border border-app-subtle bg-app-surface px-3 py-2 text-sm text-app-primary outline-none"
          value={prefs.responseStyle}
          onChange={(e) =>
            setPrefs(
              patchAiPreferences({
                responseStyle: e.target
                  .value as AiBehaviorPreferences['responseStyle'],
              })
            )
          }
        >
          {AI_RESPONSE_STYLES.map((style) => (
            <option key={style} value={style}>
              {t(`profile.aiStyle.${style}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between gap-3">
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
      <p className="m-0 text-xs leading-relaxed text-app-muted">
        {t('profile.aiShareHint')}
      </p>

      <div className="flex items-center justify-between gap-3">
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
      <p className="m-0 text-xs leading-relaxed text-app-muted">
        {t('profile.aiDebugHint')}
        {debug ? ` · ${t('profile.aiDebugOn')}` : ''}
      </p>
    </div>
  );
};

const AiSettings = () => {
  const { t } = useLocalization();
  const access = useAiAccess();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(getProviderSettings);
  const [, setStatsVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setSettings(getProviderSettings());
      setStatsVersion((version) => version + 1);
    };
    window.addEventListener(PREFS_APPLIED_EVENT, refresh);
    void pullPreferencesFromProfile();
    return () => window.removeEventListener(PREFS_APPLIED_EVENT, refresh);
  }, []);

  const keys: Record<AiProviderId, string> = {
    gemini: access.geminiApiKey,
    openrouter: access.openrouterApiKey,
  };
  const synced: Record<AiProviderId, boolean | undefined> = {
    gemini: access.geminiSynced,
    openrouter: access.openrouterSynced,
  };
  const savers: Record<
    AiProviderId,
    { save: (key: string) => Promise<'synced' | 'local'> }
  > = {
    gemini: { save: access.saveGemini },
    openrouter: { save: access.saveOpenrouter },
  };

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
            {access.geminiStatus === 'loading' ? (
              <p className="text-sm text-app-muted">{t('common.loading')}</p>
            ) : (
              <>
                <NestedSection title={t('profile.aiSectionProviders')} defaultOpen>
                  <ProvidersSection
                    settings={settings}
                    onChange={setSettings}
                    keys={keys}
                    synced={synced}
                    savers={savers}
                  />
                </NestedSection>

                <NestedSection title={t('profile.aiSectionUsage')}>
                  <UsageSection />
                </NestedSection>

                <NestedSection title={t('profile.aiSectionPrefs')}>
                  <PreferencesSection />
                </NestedSection>
              </>
            )}
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
