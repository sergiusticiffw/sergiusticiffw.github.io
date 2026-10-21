import { useState } from 'react';
import { FiChevronUp, FiLock } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { getSession, useEncryptionState } from '../../crypto/encryptionState';
import { getKeyText } from '../../crypto/keyStore';
import {
  DriveError,
  DriveKeyConflictError,
  preloadGoogleIdentity,
  saveKeyToDrive,
} from '../../crypto/driveVault';
import LockWizard from './LockWizard';
import UnlockWizard from './UnlockWizard';

const PrivacySettings = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const encryption = useEncryptionState();
  const [open, setOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    const text = getKeyText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showNotification(t('privacy.copied'), notificationType.SUCCESS);
  };

  const saveDrive = async () => {
    const session = getSession();
    const text = getKeyText();
    if (!session || !text) return;
    setBusy(true);
    try {
      await preloadGoogleIdentity();
      await saveKeyToDrive(session.uid, text);
      showNotification(t('privacy.savedDrive'), notificationType.SUCCESS);
    } catch (err) {
      const message =
        err instanceof DriveKeyConflictError
          ? t('privacy.driveDifferent')
          : err instanceof DriveError
            ? err.message
            : t('error.unknown');
      showNotification(message, notificationType.ERROR);
    } finally {
      setBusy(false);
    }
  };

  const status = encryption.status;

  const body =
    status === 'on' ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-app-secondary">{t('privacy.lockedTitle')}</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={copy} disabled={!encryption.hasKey} className="py-2.5 rounded-lg border border-white/15 text-app-primary bg-transparent cursor-pointer disabled:opacity-40">
              {t('privacy.copyKey')}
            </button>
            <button type="button" onClick={saveDrive} disabled={busy || !encryption.hasKey} className="py-2.5 rounded-lg border border-white/15 text-app-primary bg-transparent cursor-pointer disabled:opacity-40">
              {t('privacy.saveDrive')}
            </button>
            <button type="button" onClick={() => setUnlockOpen(true)} className="py-2.5 rounded-lg border border-white/15 text-app-primary bg-transparent cursor-pointer">
              {t('privacy.unlockButton')}
            </button>
          </div>
        </div>
    ) : status === 'migrating' || status === 'unlocking' ? (
        <p className="m-0 text-sm text-app-secondary">{t('privacy.inProgress')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-app-secondary">{t('privacy.lockBody')}</p>
          <p className="m-0 text-sm text-amber-200/90">{t('privacy.lockLoans')}</p>
          <button
            type="button"
            onClick={() => setLockOpen(true)}
            disabled={status === null}
            className="py-3 rounded-lg bg-[var(--color-app-accent)] text-white border-none cursor-pointer disabled:opacity-40"
          >
            {t('privacy.lockButton')}
          </button>
        </div>
      );

  return (
    <>
      {open ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2.5 mb-3 bg-transparent border-none cursor-pointer p-0 text-left"
            aria-expanded="true"
          >
            <span className="flex items-center gap-2.5 [&_svg]:text-lg [&_svg]:text-[var(--color-app-accent)]">
              <FiLock />
              <h3 className="text-base md:text-sm font-semibold text-app-primary m-0">
                {t('privacy.title')}
              </h3>
            </span>
            <FiChevronUp className="text-app-muted" aria-hidden />
          </button>
          {body}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-center bg-transparent border-none cursor-pointer py-1 text-xs text-app-muted hover:text-app-secondary"
          aria-expanded="false"
        >
          {t('privacy.title')}
        </button>
      )}

      {lockOpen && <LockWizard onClose={() => setLockOpen(false)} />}
      {unlockOpen && <UnlockWizard onClose={() => setUnlockOpen(false)} />}
    </>
  );
};

export default PrivacySettings;
