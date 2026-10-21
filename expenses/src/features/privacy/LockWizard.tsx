import { useEffect, useState } from 'react';
import { FiCheck, FiCloud, FiKey } from 'react-icons/fi';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useLocalization } from '@shared/context/localization';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { generateKey } from '../../crypto/keyFormat';
import { getSession, storeKey } from '../../crypto/encryptionState';
import { getKeyText } from '../../crypto/keyStore';
import { PreflightCheck, runPreflight, startTransition } from '../../crypto/migration';
import { syncPendingOperations } from '@shared/utils/syncService';
import {
  DriveError,
  DriveKeyConflictError,
  preloadGoogleIdentity,
  readKeyFromDrive,
  saveKeyToDrive,
} from '../../crypto/driveVault';
import KeyBox from './KeyBox';
import PreflightList from './PreflightList';

interface LockWizardProps {
  onClose: () => void;
}

const choiceClass =
  'flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left text-sm font-medium text-app-primary cursor-pointer transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40';

const LockWizard = ({ onClose }: LockWizardProps) => {
  const { t } = useLocalization();
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState<PreflightCheck[] | null>(null);
  const [keyText, setKeyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [driveOk, setDriveOk] = useState(false);
  const [savedAck, setSavedAck] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadChecks = async () => {
    setBusy(true);
    setError('');
    const session = getSession();
    const next = await runPreflight(async () => {
      if (session) await syncPendingOperations(session.token);
    });
    setChecks(next);
    setBusy(false);
  };

  useEffect(() => {
    loadChecks();
    preloadGoogleIdentity().catch(() => undefined);
  }, []);

  const ready = !!checks && checks.every((check) => check.ok);
  const canContinueKey = !!keyText && (driveOk || (copied && savedAck));

  const useDrive = async () => {
    const session = getSession();
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const existing = await readKeyFromDrive(session.uid);
      if (!existing) {
        setError(t('privacy.noDriveKey'));
        return;
      }
      setKeyText(existing);
      setDriveOk(true);
    } catch (err) {
      setError(err instanceof DriveError ? err.message : t('error.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const makeKey = async () => {
    setError('');
    setDriveOk(false);
    setCopied(false);
    setKeyText(await generateKey());
  };

  const copyKey = async () => {
    if (!keyText) return;
    await navigator.clipboard.writeText(keyText);
    setCopied(true);
  };

  const saveDrive = async () => {
    const session = getSession();
    if (!session || !keyText) return;
    setBusy(true);
    setError('');
    try {
      await saveKeyToDrive(session.uid, keyText);
      setDriveOk(true);
    } catch (err) {
      if (err instanceof DriveKeyConflictError) {
        setError(t('privacy.driveDifferent'));
      } else {
        setError(err instanceof DriveError ? err.message : t('error.unknown'));
      }
    } finally {
      setBusy(false);
    }
  };

  const goConfirm = async () => {
    await storeKey(keyText);
    setStep(3);
  };

  const run = () => {
    if (confirm.trim().toUpperCase() !== 'LOCK') return;
    if (!getKeyText()) return;
    startTransition('lock');
    onClose();
  };

  const footerDisabled =
    step === 1 ? !ready || busy : step === 2 ? !canContinueKey : confirm.trim().toUpperCase() !== 'LOCK';

  const footerAction = () => {
    if (step === 1) setStep(2);
    else if (step === 2) goConfirm();
    else run();
  };

  return (
    <VaulDrawer
      show
      onClose={() => onClose()}
      title={t('privacy.lockTitle')}
      footer={
        <button
          type="button"
          disabled={footerDisabled}
          onClick={footerAction}
          className={BTN_SUBMIT_CLASS}
        >
          {step === 3 ? t('privacy.lockButton') : t('privacy.continue')}
        </button>
      }
    >
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-app-secondary">{t('privacy.lockBody')}</p>
          <p className="m-0 text-sm text-amber-200/90">{t('privacy.lockLoans')}</p>
          {checks && <PreflightList checks={checks} t={t} />}
          <button type="button" onClick={loadChecks} disabled={busy} className="py-2.5 rounded-lg border border-white/15 text-app-primary bg-transparent cursor-pointer disabled:opacity-40">
            {t('privacy.retry')}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2">
            <button type="button" disabled={busy} onClick={useDrive} className={choiceClass}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]">
                <FiCloud className="text-lg" aria-hidden />
              </span>
              {t('privacy.useDriveKey')}
            </button>
            <button type="button" disabled={busy} onClick={makeKey} className={choiceClass}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-app-primary">
                <FiKey className="text-lg" aria-hidden />
              </span>
              {t('privacy.generateKey')}
            </button>
          </div>

          {keyText && (
            <KeyBox
              value={keyText}
              copied={copied}
              onCopy={copyKey}
              copyLabel={t('privacy.copyKey')}
              copiedLabel={t('privacy.copied')}
            />
          )}

          {keyText && (
            <button
              type="button"
              disabled={busy || driveOk}
              onClick={saveDrive}
              className={
                driveOk
                  ? 'flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-3 text-sm font-medium text-emerald-300'
                  : choiceClass + ' justify-center'
              }
            >
              {driveOk && <FiCheck aria-hidden />}
              {driveOk ? t('privacy.savedDrive') : t('privacy.saveDrive')}
            </button>
          )}

          {keyText && !driveOk && (
            <label
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer ${
                savedAck
                  ? 'border-[var(--color-app-accent)]/40 bg-[var(--color-app-accent)]/10'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <input
                type="checkbox"
                checked={savedAck}
                onChange={(event) => setSavedAck(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-app-accent)]"
              />
              <span className="text-sm leading-snug text-app-secondary">{t('privacy.savedCheckbox')}</span>
            </label>
          )}

          {error && (
            <p className="m-0 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3.5 py-2.5 text-sm text-amber-200">
              {error}
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-app-secondary">{t('privacy.confirmLockBody')}</p>
          <p className="m-0 text-sm text-amber-200/90">{t('privacy.lockLoans')}</p>
          <label className="text-xs text-app-muted uppercase tracking-wider" htmlFor="lock-confirm">
            {t('privacy.typeLock')}
          </label>
          <input
            id="lock-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="form-input"
            autoComplete="off"
          />
        </div>
      )}
    </VaulDrawer>
  );
};

export default LockWizard;
