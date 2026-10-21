import { useEffect, useState } from 'react';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useLocalization } from '@shared/context/localization';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { getSession } from '../../crypto/encryptionState';
import { PreflightCheck, runPreflight, startTransition } from '../../crypto/migration';
import { syncPendingOperations } from '@shared/utils/syncService';
import { deleteKeyFromDrive } from '../../crypto/driveVault';
import PreflightList from './PreflightList';

interface UnlockWizardProps {
  onClose: () => void;
}

const UnlockWizard = ({ onClose }: UnlockWizardProps) => {
  const { t } = useLocalization();
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState<PreflightCheck[] | null>(null);
  const [confirm, setConfirm] = useState('');
  const [deleteDrive, setDeleteDrive] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadChecks = async () => {
    setBusy(true);
    const session = getSession();
    const next = await runPreflight(async () => {
      if (session) await syncPendingOperations(session.token);
    });
    setChecks(next);
    setBusy(false);
  };

  useEffect(() => {
    loadChecks();
  }, []);

  const ready = !!checks && checks.every((check) => check.ok);

  const run = () => {
    if (confirm.trim().toUpperCase() !== 'UNLOCK') return;
    startTransition('unlock', {
      afterDone: deleteDrive ? () => deleteKeyFromDrive() : undefined,
    });
    onClose();
  };

  return (
    <VaulDrawer
      show
      onClose={() => onClose()}
      title={t('privacy.unlockTitle')}
      footer={
        <button
          type="button"
          disabled={step === 1 ? !ready || busy : confirm.trim().toUpperCase() !== 'UNLOCK'}
          onClick={() => (step === 1 ? setStep(2) : run())}
          className={BTN_SUBMIT_CLASS}
        >
          {step === 2 ? t('privacy.unlockButton') : t('privacy.continue')}
        </button>
      }
    >
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {checks && <PreflightList checks={checks} t={t} />}
          <button type="button" onClick={loadChecks} disabled={busy} className="py-2.5 rounded-lg border border-white/15 text-app-primary bg-transparent cursor-pointer disabled:opacity-40">
            {t('privacy.retry')}
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-app-secondary">{t('privacy.confirmUnlockBody')}</p>
          <label className="flex items-start gap-2 text-sm text-app-secondary">
            <input type="checkbox" checked={deleteDrive} onChange={(event) => setDeleteDrive(event.target.checked)} />
            {t('privacy.deleteDrive')}
          </label>
          <label className="text-xs text-app-muted uppercase tracking-wider" htmlFor="unlock-confirm">
            {t('privacy.typeUnlock')}
          </label>
          <input
            id="unlock-confirm"
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

export default UnlockWizard;
