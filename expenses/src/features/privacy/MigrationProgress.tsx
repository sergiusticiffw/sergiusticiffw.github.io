import { useState } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import {
  useEncryptionState,
} from '../../crypto/encryptionState';
import {
  cancelLock,
  dismissTransition,
  requestPause,
  resumeTransition,
  useTransitionProgress,
} from '../../crypto/migration';

const PHASES = ['transform', 'verify', 'cleanup'] as const;

const ghostBtn =
  'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-app-secondary cursor-pointer hover:bg-white/[0.08]';
const accentBtn =
  'rounded-lg border-none bg-[var(--color-app-accent)] px-3 py-2 text-sm font-medium text-white cursor-pointer';

const MigrationProgress = () => {
  const { t } = useLocalization();
  const encryption = useEncryptionState();
  const progress = useTransitionProgress();
  const [minimized, setMinimized] = useState(false);

  const transitional =
    encryption.status === 'migrating' || encryption.status === 'unlocking';
  const active =
    progress.state === 'running' ||
    progress.state === 'paused' ||
    progress.state === 'failed' ||
    progress.state === 'done';
  const resume =
    transitional && (progress.state === 'idle' || progress.state === 'paused');

  if (!active && !resume && encryption.corruptCount === 0) return null;

  const direction = progress.direction || (encryption.status === 'unlocking' ? 'unlock' : 'lock');
  const title =
    direction === 'unlock' ? t('privacy.unlockingTitle') : t('privacy.lockingTitle');
  const percent = Math.round(progress.percent);
  const percentLabel =
    percent < 1 && progress.phaseDone > 0 ? '<1%' : `${percent}%`;
  const barWidth = percent < 1 && progress.phaseDone > 0 ? 1.5 : percent;
  const countTotal = progress.phaseTotal || progress.itemsTotal;
  const eta =
    progress.etaMs && progress.etaMs > 0
      ? t('privacy.eta').replace('{min}', String(Math.max(1, Math.round(progress.etaMs / 60000))))
      : '';

  if (minimized && progress.state === 'running') {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-[10000] flex items-center gap-2 rounded-full border border-white/10 bg-[var(--color-app-bg)]/95 px-3.5 py-2 text-sm text-app-primary shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl cursor-pointer"
      >
        <span className="size-2 rounded-full bg-[var(--color-app-accent)]" aria-hidden />
        {title}
        <span className="text-app-muted">{percentLabel}</span>
      </button>
    );
  }

  return (
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 z-[10000] mx-auto max-w-[420px] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[var(--color-app-bg)]/95 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {encryption.corruptCount > 0 && progress.state !== 'running' && (
          <p className="m-0 mb-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-200">
            {t('privacy.corrupt').replace('{count}', String(encryption.corruptCount))}
          </p>
        )}
        {(active || resume) && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]">
                {direction === 'unlock' ? <FiUnlock aria-hidden /> : <FiLock aria-hidden />}
              </span>
              <h2 className="m-0 min-w-0 flex-1 text-base font-semibold text-app-primary">{title}</h2>
              <span className="text-sm font-semibold tabular-nums text-app-primary">{percentLabel}</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {PHASES.map((phase, index) => {
                const done = progress.step > index || progress.state === 'done';
                const current = progress.step === index && progress.state !== 'done';
                const label = t(
                  direction === 'unlock' && phase === 'transform'
                    ? 'privacy.phase.decrypt'
                    : `privacy.phase.${phase}`
                );
                return (
                  <span
                    key={phase}
                    className={`rounded-lg px-1.5 py-1.5 text-center text-[11px] font-medium leading-tight ${
                      done
                        ? 'bg-emerald-400/10 text-emerald-300'
                        : current
                          ? 'bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]'
                          : 'bg-white/[0.04] text-app-muted'
                    }`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--color-app-accent)] transition-[width] duration-300"
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <p className="m-0 mt-2.5 text-xs text-app-muted">
              {countTotal > 0 &&
                `${progress.phaseDone.toLocaleString()} / ${countTotal.toLocaleString()}`}
              {eta ? ` · ${eta}` : ''}
            </p>
            {progress.message && (
              <p className="m-0 mt-1 text-sm text-app-secondary">{progress.message}</p>
            )}
            {progress.state === 'running' && (
              <p className="m-0 mt-1 text-xs text-app-muted">{t('privacy.browsing')}</p>
            )}
            {progress.state === 'done' && (
              <p className="m-0 mt-2 text-sm text-emerald-300">
                {direction === 'unlock' ? t('privacy.doneUnlock') : t('privacy.doneLock')}
              </p>
            )}
            {progress.failures.length > 0 && (
              <ul className="m-0 mt-3 list-none space-y-1 rounded-lg border border-amber-300/25 bg-amber-300/10 p-2.5 text-xs text-amber-200">
                {progress.failures.slice(0, 5).map((failure) => (
                  <li key={failure.id}>
                    {failure.dt} {failure.sum}: {failure.reason}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3.5 flex flex-wrap justify-end gap-2">
              {progress.state === 'running' && (
                <>
                  <button type="button" className={ghostBtn} onClick={() => setMinimized(true)}>
                    {t('privacy.minimize')}
                  </button>
                  <button type="button" className={ghostBtn} onClick={requestPause}>
                    {t('privacy.pause')}
                  </button>
                </>
              )}
              {resume && (
                <button type="button" className={accentBtn} onClick={() => resumeTransition()}>
                  {t('privacy.resume')}
                </button>
              )}
              {direction === 'lock' && (progress.state === 'paused' || encryption.status === 'migrating') && progress.state !== 'running' && (
                <button type="button" className={ghostBtn} onClick={() => cancelLock()}>
                  {t('privacy.cancelLock')}
                </button>
              )}
              {(progress.state === 'done' || progress.state === 'failed') && (
                <button type="button" className={ghostBtn} onClick={dismissTransition}>
                  {t('common.close')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MigrationProgress;
