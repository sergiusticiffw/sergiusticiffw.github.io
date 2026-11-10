import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState } from '../../context';
import { useExpenseData } from '@stores/expenseStore';
import { loanDispatch } from '@stores/loanStore';
import {
  useSettingsCurrency,
  setSettingsCurrency,
  useSettingsTheme,
  setSettingsTheme,
  useGoalsEnabled,
  setGoalsEnabled,
} from '@stores/settingsStore';
import { APP_THEMES } from '@shared/constants/themes';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { logout } from '@shared/context/actions';
import { useNavigate } from '@tanstack/react-router';
import {
  FiUser,
  FiLogOut,
  FiSettings,
  FiBarChart2,
  FiDroplet,
  FiShield,
  FiDatabase,
  FiDownload,
  FiLoader,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import ChartsVisibilityDnd from '@shared/components/ChartsVisibilityDnd';
import { fetchRequest, buildApiUrl } from '@shared/utils/utils';
import {
  notificationType,
  availableCharts,
  currencies,
} from '@shared/utils/constants';
import {
  readCustomChartsEnabled,
  readStoredVisibleCharts,
  writeCustomChartsEnabled,
  writeStoredVisibleCharts,
} from '@shared/utils/chartsVisibility';
import { Switch } from '@shared/ui';
import AiSettings from '@features/assistant/components/AiSettings';
import TagSettings from '../../../features/profile/TagSettings';
import PrivacySettings from '../../../features/privacy/PrivacySettings';
import BiometricSettings from '../../../features/privacy/BiometricSettings';
import {
  PAGE_CONTAINER_CLASS,
  BTN_SUBMIT_CLASS,
} from '@shared/utils/layoutClasses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { googleLogout } from '@react-oauth/google';
import { DriveError } from '../../../crypto/driveVault';
import {
  readGoalsFromDriveSilent,
  requireSessionUid,
  saveGoalsToDrive,
} from '../../../features/goals/driveSync';
import {
  getEmergencyFund,
  replaceEmergencyFund,
} from '../../../features/goals/store';
import { newerEmergencyFund } from '../../../features/goals/model';
import { buildBackupSnapshot } from '../../../features/backup/buildBackup';
import {
  downloadBackupJson,
  downloadDriveBackupById,
  formatBackupSize,
  getLastBackupAt,
  listDriveBackups,
  pruneDriveBackups,
  setLastBackupAt,
  uploadBackupToDrive,
  type DriveBackupListItem,
} from '../../../features/backup/driveBackup';

const Profile = () => {
  const showNotification = useNotification();
  const { language, setLanguage, t } = useLocalization();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useExpenseData();
  const { userDetails, token } = useAuthState();
  const currency = useSettingsCurrency();
  const currentTheme = useSettingsTheme();
  const goalsEnabled = useGoalsEnabled();
  const apiClient = useApiClient();
  const [goalsSyncing, setGoalsSyncing] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupList, setBackupList] = useState<DriveBackupListItem[]>([]);
  const [backupListLoading, setBackupListLoading] = useState(false);
  const [backupListLoaded, setBackupListLoaded] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(
    null
  );
  const [lastBackupAt, setLastBackupAtState] = useState<string | null>(() =>
    getLastBackupAt()
  );
  const [state, setState] = useState(() => ({
    visibleCharts: readStoredVisibleCharts(),
  }));
  const [customChartsEnabled, setCustomChartsEnabled] = useState(
    readCustomChartsEnabled
  );
  const [chartsAccordionOpen, setChartsAccordionOpen] = useState(false);
  const navigate = useNavigate();

  // Silent pull only — never open a Google login popup on Profile visit.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (!navigator.onLine) return;
      try {
        const uid = requireSessionUid();
        const remote = await readGoalsFromDriveSilent(uid);
        if (cancelled || !remote) return;
        const localFund = getEmergencyFund();
        const merged = newerEmergencyFund(localFund, remote.fund);
        replaceEmergencyFund(merged);
        const remoteWins =
          !localFund.updatedAt ||
          (Boolean(remote.fund.updatedAt) &&
            (remote.fund.updatedAt as string) >= (localFund.updatedAt || ''));
        if (remoteWins) setGoalsEnabled(remote.enabled);
      } catch {
        // Keep local toggle; interactive Drive auth happens on save/toggle.
      }
    };
    pull();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoalsEnabledChange = async (checked: boolean) => {
    setGoalsEnabled(checked);
    const stamped = {
      ...getEmergencyFund(),
      updatedAt: new Date().toISOString(),
    };
    replaceEmergencyFund(stamped);

    if (!navigator.onLine) {
      showNotification(t('goals.savedOffline'), notificationType.SUCCESS);
      return;
    }

    setGoalsSyncing(true);
    try {
      const uid = requireSessionUid();
      await saveGoalsToDrive(uid, { fund: stamped, enabled: checked });
      showNotification(t('goals.savedDrive'), notificationType.SUCCESS);
    } catch (err) {
      const message =
        err instanceof DriveError
          ? t('goals.syncErrorDrive')
          : t('goals.syncError');
      showNotification(message, notificationType.ERROR);
    } finally {
      setGoalsSyncing(false);
    }
  };

  const refreshBackupList = async (silent = false) => {
    setBackupListLoading(true);
    try {
      if (!silent) {
        await pruneDriveBackups();
      }
      const files = await listDriveBackups({ silent });
      setBackupList(files);
      setBackupListLoaded(true);
    } catch {
      if (!silent) {
        showNotification(t('profile.backupListError'), notificationType.ERROR);
      }
    } finally {
      setBackupListLoading(false);
    }
  };

  const handleBackupToDrive = async () => {
    setBackupBusy(true);
    try {
      const uid = requireSessionUid();
      const snapshot = await buildBackupSnapshot(uid, {
        apiClient,
        expenseDispatch: dataDispatch,
        loanDispatch,
      });
      downloadBackupJson(snapshot);

      try {
        await uploadBackupToDrive(snapshot);
        setLastBackupAt(snapshot.createdAt);
        setLastBackupAtState(snapshot.createdAt);
        showNotification(t('profile.backupDone'), notificationType.SUCCESS);
        await refreshBackupList(true);
      } catch (err) {
        const message =
          err instanceof DriveError
            ? t('profile.backupErrorDrive')
            : t('profile.backupDownloaded');
        showNotification(message, notificationType.ERROR);
      }
    } catch {
      showNotification(t('profile.backupError'), notificationType.ERROR);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadDriveBackup = async (item: DriveBackupListItem) => {
    setDownloadingBackupId(item.id);
    try {
      await downloadDriveBackupById(item.id, item.name);
      showNotification(t('profile.backupDownloadDone'), notificationType.SUCCESS);
    } catch (err) {
      const message =
        err instanceof DriveError
          ? t('profile.backupErrorDrive')
          : t('profile.backupDownloadError');
      showNotification(message, notificationType.ERROR);
    } finally {
      setDownloadingBackupId(null);
    }
  };

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newLanguage = event.target.value as 'en' | 'ro';
    setLanguage(newLanguage);
    showNotification(
      t('notification.profileUpdated'),
      notificationType.SUCCESS
    );
  };

  const handleLogout = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    googleLogout();
    logout(dispatch, dataDispatch);
    navigate({ to: '/expenses/login' });
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const fetchOptions = {
      method: 'PATCH',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': 'Bearer ' + token,
      }),
      body: JSON.stringify({ field_currency: [event.target.value] }),
    };
    const url = buildApiUrl(`/user/${userDetails.current_user.uid}?_format=json`);
    fetchRequest(
      url,
      fetchOptions,
      dataDispatch,
      dispatch,
      (data: { uid?: number; field_currency?: { value: string }[] }) => {
        if (data.uid && data.field_currency?.[0]) {
          const newCurrency = data.field_currency[0].value;
          userDetails.current_user.currency = newCurrency;
          localStorage.setItem('currentUser', JSON.stringify(userDetails));
          setSettingsCurrency(newCurrency);
          dispatch({
            type: 'UPDATE_USER',
            payload: { currency: newCurrency },
          });
          setBlink(true);
          setTimeout(() => setBlink(false), 2000);
        } else {
          showNotification(t('error.unknown'), notificationType.ERROR);
        }
      }
    );
  };

  const sortedCurrencies = Object.entries(currencies).sort((a, b) => {
    return a[1] < b[1] ? -1 : 1;
  });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    writeStoredVisibleCharts(state.visibleCharts);
  }, [state.visibleCharts]);

  useEffect(() => {
    writeCustomChartsEnabled(customChartsEnabled);
  }, [customChartsEnabled]);

  const visibleChartsOrdered = state.visibleCharts.filter((c) =>
    availableCharts.includes(c)
  );
  const hiddenChartsOrdered = availableCharts.filter(
    (c) => !state.visibleCharts.includes(c)
  );

  const handleVisibleChartsChange = (visible: string[]) => {
    setState((prev) => ({ ...prev, visibleCharts: visible }));
  };

  return (
    <div className={`${PAGE_CONTAINER_CLASS} flex flex-col items-center pt-5 md:pt-4`}>
      {/* Header */}
      <div className="text-left mb-6 w-full max-w-[600px] md:mb-5">
        <h1 className="text-2xl md:text-xl font-semibold text-app-primary m-0 tracking-tight">
          {t('profile.title')}
        </h1>
      </div>

      {/* Settings Sections */}
      <div className="flex flex-col gap-4 w-full max-w-[600px] md:gap-3.5">
        {/* Account Section */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiUser />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.account')}
            </h3>
          </div>
          <div className="flex items-center gap-3 py-3 md:py-2.5">
            <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] shrink-0" />
            <div className="text-[0.9rem] md:text-sm text-app-secondary font-medium tracking-tight">
              {userDetails.current_user.name}
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiDroplet />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.theme')}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {APP_THEMES.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSettingsTheme(theme.id);
                    window.dispatchEvent(
                      new CustomEvent('localStorageChange', {
                        detail: { key: 'theme', value: theme.id },
                      })
                    );
                    showNotification(
                      t('notification.profileUpdated'),
                      notificationType.SUCCESS
                    );
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{
                      background: theme.bg,
                      boxShadow: `inset 0 0 0 2px ${theme.accent}`,
                    }}
                  />
                  <span className="text-xs font-medium text-app-secondary truncate w-full text-center">
                    {t(theme.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language & Currency Settings */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiSettings />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.personalInfo')}
            </h3>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="language" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.language')}
            </label>
            <select
              id="language"
              value={language}
              name="language"
              onChange={handleLanguageChange}
              className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary [&_option]:p-2"
            >
              <option value="en">{t('profile.english')}</option>
              <option value="ro">{t('profile.romanian')}</option>
            </select>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="currency" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.currency')}
            </label>
            <select
              id="currency"
              value={currency}
              name="currency"
              onChange={handleChange}
              className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary [&_option]:p-2"
            >
              {sortedCurrencies.map(([id, currency]) => (
                <option key={id} value={id}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AiSettings />

        <TagSettings />

        {/* Emergency fund / Goals */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiShield />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.goalsSettings')}
            </h3>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span
                id="goals-enabled-label"
                className="block text-body text-app-secondary"
              >
                {t('profile.goalsEnable')}
              </span>
              <p className="m-0 mt-1 text-xs text-app-muted">
                {t('profile.goalsEnableHint')}
              </p>
            </div>
            <Switch
              checked={goalsEnabled}
              onCheckedChange={handleGoalsEnabledChange}
              disabled={goalsSyncing}
              aria-labelledby="goals-enabled-label"
            />
          </div>
        </div>

        {/* Manual full-data backup */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiDatabase />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.backupTitle')}
            </h3>
          </div>
          <p className="m-0 mb-4 text-xs text-app-muted leading-relaxed">
            {t('profile.backupHint')}
          </p>
          {lastBackupAt && (
            <p className="m-0 mb-3 text-caption text-app-secondary">
              {t('profile.backupLastAt').replace(
                '{date}',
                new Date(lastBackupAt).toLocaleString(
                  language === 'ro' ? 'ro-RO' : 'en-US'
                )
              )}
            </p>
          )}
          <button
            type="button"
            onClick={handleBackupToDrive}
            disabled={backupBusy || backupListLoading}
            className={BTN_SUBMIT_CLASS}
          >
            {backupBusy ? (
              <FiLoader className="animate-spin" aria-hidden />
            ) : (
              <FiDatabase aria-hidden />
            )}
            {backupBusy ? t('profile.backupBusy') : t('profile.backupButton')}
          </button>

          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-app-muted">
                {t('profile.backupListTitle')}
              </h4>
              <button
                type="button"
                onClick={() => refreshBackupList(false)}
                disabled={backupListLoading || backupBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-caption font-semibold text-app-secondary hover:border-white/25 hover:text-app-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {backupListLoading ? (
                  <FiLoader className="animate-spin" aria-hidden />
                ) : (
                  <FiRefreshCw aria-hidden />
                )}
                {backupListLoading
                  ? t('profile.backupListLoading')
                  : t('profile.backupListLoad')}
              </button>
            </div>

            {backupListLoaded && backupList.length === 0 && !backupListLoading && (
              <p className="m-0 text-caption text-app-muted">
                {t('profile.backupListEmpty')}
              </p>
            )}

            {backupList.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {backupList.map((item) => {
                  const when = item.createdAt
                    ? new Date(item.createdAt).toLocaleString(
                        language === 'ro' ? 'ro-RO' : 'en-US'
                      )
                    : item.name;
                  const downloading = downloadingBackupId === item.id;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-medium text-app-primary">
                          {when}
                        </p>
                        <p className="m-0 mt-0.5 truncate text-caption text-app-muted">
                          {formatBackupSize(item.sizeBytes)} · {item.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadDriveBackup(item)}
                        disabled={downloading || backupBusy}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-caption font-semibold text-app-secondary hover:border-white/25 hover:text-app-primary disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('profile.backupDownload')}
                        title={t('profile.backupDownload')}
                      >
                        {downloading ? (
                          <FiLoader className="animate-spin" aria-hidden />
                        ) : (
                          <FiDownload aria-hidden />
                        )}
                        {downloading
                          ? t('profile.backupDownloading')
                          : t('profile.backupDownload')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Charts Settings (accordion, closed by default) */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden md:rounded-[10px] transition-colors active:border-white/10">
          <button
            type="button"
            onClick={() => setChartsAccordionOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2.5 py-5 px-5 md:py-4 md:px-4 text-left bg-transparent border-none cursor-pointer [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:shrink-0"
            aria-expanded={chartsAccordionOpen}
          >
            <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
              <FiBarChart2 />
              <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
                {t('profile.chartsSettings')}
              </h3>
            </div>
            {chartsAccordionOpen ? (
              <FiChevronUp className="text-app-muted" aria-hidden />
            ) : (
              <FiChevronDown className="text-app-muted" aria-hidden />
            )}
          </button>
          {chartsAccordionOpen && (
            <div className="px-5 pb-5 pt-0 md:px-4 md:pb-4 border-t border-white/[0.06]">
              <div className="pt-4 md:pt-3">
                <h4 className="text-xs font-semibold text-app-muted m-0 mb-3 md:mb-2.5 uppercase tracking-wider">
                  {t('profile.chartsVisibility')}
                </h4>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span
                    id="charts-customize-label"
                    className="text-body text-app-secondary"
                  >
                    {t('profile.chartsCustomize')}
                  </span>
                  <Switch
                    checked={customChartsEnabled}
                    onCheckedChange={setCustomChartsEnabled}
                    aria-labelledby="charts-customize-label"
                  />
                </div>
                {customChartsEnabled && (
                  <>
                    <p className="text-xs text-app-muted mb-3">
                      {t('profile.chartsDragHint')}
                    </p>
                    <ChartsVisibilityDnd
                      visibleCharts={visibleChartsOrdered}
                      hiddenCharts={hiddenChartsOrdered}
                      onVisibleChartsChange={handleVisibleChartsChange}
                      t={t}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <BiometricSettings
          userId={String(userDetails?.current_user?.uid ?? '')}
          displayName={String(userDetails?.current_user?.name ?? '')}
        />

        <PrivacySettings />

        {/* Logout Button */}
        <button
          type="button"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 px-5 md:py-3 md:px-4 bg-transparent border border-red-500/30 rounded-xl text-red-400 text-sm md:text-[0.875rem] font-medium cursor-pointer transition-all active:bg-red-500/5 active:border-red-500/50 [&_svg]:text-lg md:[&_svg]:text-base"
          onClick={handleLogout}
        >
          <FiLogOut />
          {t('profile.signOut')}
        </button>
      </div>
    </div>
  );
};

export default Profile;
