import React, { useState, useEffect, useRef } from 'react';
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
  FiUpload,
  FiLoader,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import ChartsVisibilityDnd from '@shared/components/ChartsVisibilityDnd';
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
import FamilySettings from '../../../features/profile/FamilySettings';
import PrivacySettings from '../../../features/privacy/PrivacySettings';
import BiometricSettings from '../../../features/privacy/BiometricSettings';
import { getDataProviderKind } from '../../../data';
import {
  PAGE_CONTAINER_CLASS,
  BTN_SUBMIT_CLASS,
} from '@shared/utils/layoutClasses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { googleLogout } from '@react-oauth/google';
import { DriveError } from '../../../crypto/driveVault';
import {
  applyGoalsBackupBundle,
  loadAndClaimGoalsFromDrive,
  requireSessionUid,
  saveGoalsToDrive,
} from '../../../features/goals/driveSync';
import {
  getEmergencyFund,
  replaceEmergencyFund,
} from '../../../features/goals/store';
import { newerEmergencyFund } from '../../../features/goals/model';
import {
  buildBackupSnapshot,
  type ExpensesBackupSnapshot,
} from '../../../features/backup/buildBackup';
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
import {
  ImportBackupError,
  importBackupToSupabase,
  readBackupFile,
  type ImportBackupProgress,
} from '../../../features/backup/importBackup';
import { fetchExpenses as fetchExpensesService } from '../../../features/expenses/api/expenses';
import { fetchLoans as fetchLoansService } from '../../../features/loans/api/loans';
import { DeleteConfirmDrawer } from '@shared/components/Common';

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
  const [backupAccordionOpen, setBackupAccordionOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] =
    useState<ImportBackupProgress | null>(null);
  const [pendingImport, setPendingImport] =
    useState<ExpensesBackupSnapshot | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isSupabase = getDataProviderKind() === 'supabase';

  // Silent pull only — never open a Google login popup on Profile visit.
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (!navigator.onLine) return;
      try {
        const uid = requireSessionUid();
        const { bundle: remote, claimed } = await loadAndClaimGoalsFromDrive(
          uid,
          { silent: true }
        );
        if (cancelled || !remote) return;
        const localFund = getEmergencyFund();
        const merged = newerEmergencyFund(localFund, remote.fund);
        replaceEmergencyFund(merged);
        const remoteWins =
          !localFund.updatedAt ||
          (Boolean(remote.fund.updatedAt) &&
            (remote.fund.updatedAt as string) >= (localFund.updatedAt || ''));
        if (remoteWins) setGoalsEnabled(remote.enabled);
        if (claimed) {
          showNotification(t('goals.claimed'), notificationType.SUCCESS);
        }
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
        accessToken: token,
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
      const snapshot = await downloadDriveBackupById(item.id, item.name);
      if (snapshot.goals?.fund) {
        try {
          const uid = requireSessionUid();
          await applyGoalsBackupBundle(uid, {
            fund: snapshot.goals.fund,
            enabled: !!snapshot.goals.enabled,
          });
          showNotification(
            t('profile.backupDownloadDoneGoals'),
            notificationType.SUCCESS
          );
        } catch {
          showNotification(
            t('profile.backupDownloadDone'),
            notificationType.SUCCESS
          );
        }
      } else {
        showNotification(
          t('profile.backupDownloadDone'),
          notificationType.SUCCESS
        );
      }
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

  const runImportBackup = async (snapshot: ExpensesBackupSnapshot) => {
    if (!isSupabase || !token) return;
    setImportBusy(true);
    setImportProgress({ phase: 'auth', done: 0, total: 1 });
    try {
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem('currentUser') || '{}');
        } catch {
          return {};
        }
      })();
      const result = await importBackupToSupabase(snapshot, {
        accessToken: token,
        refreshToken: stored.refresh_token,
        onProgress: setImportProgress,
      });
      if (apiClient) {
        await Promise.all([
          fetchExpensesService(apiClient, dataDispatch),
          fetchLoansService(apiClient, loanDispatch),
        ]).catch(() => undefined);
      }
      const summary = t('profile.importDone')
        .replace('{tx}', String(result.transactions))
        .replace('{loans}', String(result.loans))
        .replace('{payments}', String(result.payments));
      showNotification(summary, notificationType.SUCCESS);
    } catch (err) {
      const message =
        err instanceof ImportBackupError
          ? err.message
          : t('profile.importError');
      showNotification(message, notificationType.ERROR);
    } finally {
      setImportBusy(false);
      setImportProgress(null);
      setPendingImport(null);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleImportFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const snapshot = await readBackupFile(file);
      setPendingImport(snapshot);
    } catch (err) {
      const message =
        err instanceof ImportBackupError
          ? err.message
          : t('profile.importError');
      showNotification(message, notificationType.ERROR);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const importProgressLabel = (() => {
    if (!importProgress) return '';
    const { phase, done, total } = importProgress;
    if (phase === 'done') return t('profile.importPhaseDone');
    if (total > 0 && (phase === 'transactions' || phase === 'loans' || phase === 'payments')) {
      return t('profile.importPhaseCount')
        .replace('{phase}', t(`profile.importPhase.${phase}`))
        .replace('{done}', String(done))
        .replace('{total}', String(total));
    }
    return t(`profile.importPhase.${phase}`);
  })();

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

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value;
    if (!apiClient || !userDetails?.current_user?.uid) {
      showNotification(t('error.unknown'), notificationType.ERROR);
      return;
    }
    const result = await apiClient.updateProfile(
      String(userDetails.current_user.uid),
      { currency: newCurrency }
    );
    if (result.success && result.data) {
      const saved =
        result.data.currency ||
        (result.data.raw as any)?.field_currency?.[0]?.value ||
        newCurrency;
      userDetails.current_user.currency = saved;
      localStorage.setItem('currentUser', JSON.stringify(userDetails));
      setSettingsCurrency(saved);
      dispatch({
        type: 'UPDATE_USER',
        payload: { currency: saved },
      });
      setBlink(true);
      setTimeout(() => setBlink(false), 2000);
    } else {
      showNotification(t('error.unknown'), notificationType.ERROR);
    }
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

        {getDataProviderKind() === 'supabase' && <FamilySettings />}

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

        {/* Manual full-data backup (accordion, closed by default) */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden md:rounded-[10px] transition-colors active:border-white/10">
          <button
            type="button"
            onClick={() => setBackupAccordionOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2.5 py-5 px-5 md:py-4 md:px-4 text-left bg-transparent border-none cursor-pointer [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:shrink-0"
            aria-expanded={backupAccordionOpen}
          >
            <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
              <FiDatabase />
              <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
                {t('profile.backupTitle')}
              </h3>
            </div>
            {backupAccordionOpen ? (
              <FiChevronUp className="text-app-muted" aria-hidden />
            ) : (
              <FiChevronDown className="text-app-muted" aria-hidden />
            )}
          </button>
          {backupAccordionOpen && (
            <div className="px-5 pb-5 pt-0 md:px-4 md:pb-4 border-t border-white/[0.06]">
              <div className="pt-4 md:pt-3">
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
                  disabled={backupBusy || backupListLoading || importBusy}
                  className={BTN_SUBMIT_CLASS}
                >
                  {backupBusy ? (
                    <FiLoader className="animate-spin" aria-hidden />
                  ) : (
                    <FiDatabase aria-hidden />
                  )}
                  {backupBusy
                    ? t('profile.backupBusy')
                    : t('profile.backupButton')}
                </button>

                {isSupabase && (
                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-app-muted">
                      {t('profile.importTitle')}
                    </h4>
                    <p className="m-0 mb-3 text-xs text-app-muted leading-relaxed">
                      {t('profile.importHint')}
                    </p>
                    <input
                      ref={importFileRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleImportFileChange}
                    />
                    <button
                      type="button"
                      disabled={importBusy || backupBusy}
                      onClick={() => importFileRef.current?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-app-secondary hover:border-white/25 hover:text-app-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importBusy ? (
                        <FiLoader className="animate-spin" aria-hidden />
                      ) : (
                        <FiUpload aria-hidden />
                      )}
                      {importBusy
                        ? importProgressLabel || t('profile.importBusy')
                        : t('profile.importButton')}
                    </button>
                  </div>
                )}

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

                  {backupListLoaded &&
                    backupList.length === 0 &&
                    !backupListLoading && (
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
            </div>
          )}
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

      <DeleteConfirmDrawer
        open={!!pendingImport && !importBusy}
        onClose={() => {
          setPendingImport(null);
          if (importFileRef.current) importFileRef.current.value = '';
        }}
        onConfirm={() => pendingImport && runImportBackup(pendingImport)}
        isSubmitting={importBusy}
        title={t('profile.importConfirmTitle')}
        message={
          pendingImport
            ? t('profile.importConfirmMessage')
                .replace(
                  '{tx}',
                  String(
                    (pendingImport.transactions?.length || 0) +
                      (pendingImport.incomes?.length || 0)
                  )
                )
                .replace(
                  '{loans}',
                  String(pendingImport.loans?.length || 0)
                )
                .replace(
                  '{payments}',
                  String(
                    (pendingImport.payments || []).reduce(
                      (n, g) => n + (g.data?.length || 0),
                      0
                    )
                  )
                )
            : undefined
        }
        confirmLabel={t('profile.importConfirmAction')}
      />
    </div>
  );
};

export default Profile;
