import { useEffect, useState } from 'react';
import { FiShield } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { Switch } from '@shared/ui';
import {
  disableBiometric,
  enrollBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
} from './biometricLock';

interface BiometricSettingsProps {
  userId: string;
  displayName: string;
}

const BiometricSettings = ({ userId, displayName }: BiometricSettingsProps) => {
  const { t } = useLocalization();
  const [supported, setSupported] = useState(false);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hasApi = isBiometricSupported();
      const platform = hasApi
        ? await isPlatformAuthenticatorAvailable()
        : false;
      if (cancelled) return;
      setSupported(hasApi);
      setAvailable(platform);
      setEnabled(isBiometricEnabled(userId));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const statusLabel = !supported
    ? t('biometric.status.unsupported')
    : !available
      ? t('biometric.status.unavailable')
      : enabled
        ? t('biometric.status.active')
        : t('biometric.status.inactive');

  const onEnable = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await enrollBiometric({ userId, displayName });
    setPending(false);
    if (result.error) {
      setError(t(result.error));
      return;
    }
    setEnabled(true);
    setMessage(t('biometric.enabled'));
  };

  const onDisable = () => {
    if (!window.confirm(t('biometric.disableConfirm'))) {
      return;
    }
    disableBiometric(userId);
    setEnabled(false);
    setError(null);
    setMessage(t('biometric.disabled'));
  };

  const canToggle = supported && available && !pending;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
      <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
        <FiShield />
        <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
          {t('biometric.title')}
        </h3>
      </div>

      <p className="m-0 mb-3 text-sm text-app-secondary">{t('biometric.body')}</p>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <span
            id="biometric-toggle-label"
            className="block text-sm text-app-primary font-medium"
          >
            {t('biometric.toggle')}
          </span>
          <span className="block text-xs text-app-muted mt-0.5">
            {t('biometric.statusLabel')}: {statusLabel}
          </span>
        </div>
        <Switch
          checked={enabled}
          disabled={!canToggle && !enabled}
          onCheckedChange={(next) => {
            if (next) {
              void onEnable();
            } else {
              onDisable();
            }
          }}
          aria-labelledby="biometric-toggle-label"
        />
      </div>

      {error ? (
        <p role="alert" className="m-0 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="m-0 text-sm text-app-muted">{message}</p>
      ) : null}
    </div>
  );
};

export default BiometricSettings;
