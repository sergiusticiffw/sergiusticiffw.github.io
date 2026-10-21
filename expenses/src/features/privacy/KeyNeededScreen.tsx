import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { googleLogout } from '@react-oauth/google';
import { useAuthDispatch } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { logout } from '@shared/context/actions';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { InvalidKeyError } from '../../crypto/keyFormat';
import { forgetKey, getSession, storeKey } from '../../crypto/encryptionState';
import { checkKeyAgainstServer } from '../../crypto/migration';
import {
  DriveError,
  preloadGoogleIdentity,
  readKeyFromDrive,
} from '../../crypto/driveVault';

const KeyNeededScreen = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useExpenseData();
  const navigate = useNavigate();
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showLost, setShowLost] = useState(false);

  const acceptKey = async (value: string) => {
    setError('');
    const text = await storeKey(value);
    const verdict = await checkKeyAgainstServer(text);
    if (verdict === 'mismatch') {
      forgetKey();
      setError(t('privacy.keyMismatch'));
      return;
    }
    showNotification(t('privacy.keyAccepted'), notificationType.SUCCESS);
  };

  const fromDrive = async () => {
    const session = getSession();
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await preloadGoogleIdentity();
      const key = await readKeyFromDrive(session.uid);
      if (!key) {
        setError(t('privacy.noDriveKey'));
        return;
      }
      await acceptKey(key);
    } catch (err) {
      setError(err instanceof DriveError ? err.message : t('error.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const fromPaste = async () => {
    setBusy(true);
    setError('');
    try {
      await acceptKey(pasted);
    } catch (err) {
      setError(err instanceof InvalidKeyError ? t('privacy.invalidKey') : t('error.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    googleLogout();
    logout(dispatch, dataDispatch);
    navigate({ to: '/expenses/login' });
  };

  return (
    <div className="max-w-[520px] mx-auto px-4 pt-10 pb-8">
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
        <h1 className="text-xl font-semibold text-app-primary m-0">
          {t('privacy.keyNeededTitle')}
        </h1>
        <p className="text-sm text-app-secondary mt-2 mb-5">{t('privacy.keyNeededBody')}</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={fromDrive}
            className="py-3 px-4 rounded-lg bg-[var(--color-app-accent)] text-white font-medium disabled:opacity-40 cursor-pointer"
          >
            {t('privacy.getDrive')}
          </button>
          <label className="text-xs text-app-muted uppercase tracking-wider" htmlFor="privacy-key">
            {t('privacy.pasteKey')}
          </label>
          <textarea
            id="privacy-key"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={t('privacy.pastePlaceholder')}
            rows={3}
            className="w-full font-mono text-sm py-3 px-3 bg-app-surface border border-app-subtle rounded-lg text-app-primary outline-none focus:border-[var(--color-app-accent)]/50"
          />
          <button
            type="button"
            disabled={busy || !pasted.trim()}
            onClick={fromPaste}
            className="py-3 px-4 rounded-lg border border-white/15 text-app-primary font-medium disabled:opacity-40 cursor-pointer"
          >
            {t('privacy.unlockWithKey')}
          </button>
          {error && <p className="m-0 text-sm text-amber-300">{error}</p>}
          <button
            type="button"
            onClick={() => setShowLost((open) => !open)}
            className="bg-transparent border-none text-left text-sm text-app-muted cursor-pointer p-0"
          >
            {t('privacy.lostKey')}
          </button>
          {showLost && (
            <p className="m-0 text-sm text-app-secondary">{t('privacy.lostKeyBody')}</p>
          )}
          <button
            type="button"
            onClick={signOut}
            className="py-3 px-4 rounded-lg border border-red-500/30 text-red-400 font-medium cursor-pointer"
          >
            {t('profile.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyNeededScreen;
