import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar,
  FiCloud,
  FiCloudOff,
  FiFlag,
  FiLoader,
  FiPlusCircle,
  FiShield,
} from 'react-icons/fi';
import { useExpenseData } from '@stores/expenseStore';
import {
  useGoalsEnabled,
  useSettingsCurrency,
  setGoalsEnabled,
} from '@stores/settingsStore';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { PageHeader, StatCard, StatsGrid } from '@shared/components/Common';
import { Card, ProgressRing, SettingsSection, cn } from '@shared/ui';
import { PAGE_CONTAINER_CLASS, BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { formatNumber } from '@shared/utils/utils';
import { notificationType } from '@shared/utils/constants';
import { DriveError } from '../../../../crypto/driveVault';
import { AmountField } from '../../components/AmountField';
import {
  TARGET_MONTH_OPTIONS,
  TargetMonths,
  averageMonthlySpend,
  monthsCovered,
  monthsToGoal,
  newerEmergencyFund,
  parseAmount,
  progressRatio,
  resolveTarget,
} from '../../model';
import {
  readGoalsFromDrive,
  requireSessionUid,
  saveGoalsToDrive,
} from '../../driveSync';
import {
  getEmergencyFund,
  replaceEmergencyFund,
  setEmergencyFund,
  useEmergencyFund,
} from '../../store';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const Goals = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const fund = useEmergencyFund();
  const { data, dataDispatch } = useExpenseData();
  const apiClient = useApiClient();
  const noData = data.groupedData === null;

  const [balanceInput, setBalanceInput] = useState(String(fund.balance || ''));
  const [customTargetInput, setCustomTargetInput] = useState(
    fund.customTarget != null ? String(fund.customTarget) : ''
  );
  const [contributionInput, setContributionInput] = useState(
    fund.monthlyContribution != null ? String(fund.monthlyContribution) : ''
  );
  const [targetMonths, setTargetMonths] = useState<TargetMonths>(
    fund.targetMonths
  );
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [noData, apiClient, dataDispatch]);

  useEffect(() => {
    setBalanceInput(fund.balance ? String(fund.balance) : '');
    setCustomTargetInput(
      fund.customTarget != null ? String(fund.customTarget) : ''
    );
    setContributionInput(
      fund.monthlyContribution != null ? String(fund.monthlyContribution) : ''
    );
    setTargetMonths(fund.targetMonths);
  }, [
    fund.balance,
    fund.customTarget,
    fund.monthlyContribution,
    fund.targetMonths,
  ]);

  // Pull full Goals package from Drive (balance, target, contribution, enabled).
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      setSyncStatus('syncing');
      try {
        const uid = requireSessionUid();
        const remote = await readGoalsFromDrive(uid);
        if (cancelled) return;

        const localFund = getEmergencyFund();
        const merged = newerEmergencyFund(localFund, remote?.fund ?? null);
        replaceEmergencyFund(merged);

        let enabled = goalsEnabled;
        if (remote) {
          const remoteWins =
            !localFund.updatedAt ||
            (Boolean(remote.fund.updatedAt) &&
              (remote.fund.updatedAt as string) >= (localFund.updatedAt || ''));
          if (remoteWins) {
            enabled = remote.enabled;
            setGoalsEnabled(remote.enabled);
          }
        }

        const localWins =
          Boolean(merged.updatedAt) &&
          (!remote?.fund.updatedAt ||
            (merged.updatedAt as string) > remote.fund.updatedAt);
        if (localWins) {
          await saveGoalsToDrive(uid, { fund: merged, enabled });
        }

        if (!cancelled) setSyncStatus('synced');
      } catch (err) {
        if (cancelled) return;
        setSyncStatus('error');
        // Silent on first open if user cancels Google popup — local still works.
        if (!(err instanceof DriveError)) {
          showNotification(t('goals.syncError'), notificationType.ERROR);
        }
      }
    };
    pull();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, []);

  const avgSpend = useMemo(
    () => averageMonthlySpend(data.raw ?? []),
    [data.raw]
  );

  const draftCustomTarget = parseAmount(customTargetInput);
  const draftContribution = parseAmount(contributionInput);
  const draftBalance = parseAmount(balanceInput) ?? 0;

  const draftFund = {
    ...fund,
    balance: draftBalance,
    targetMonths,
    customTarget: draftCustomTarget,
    monthlyContribution: draftContribution,
  };

  const target = resolveTarget(draftFund, avgSpend);
  const covered = monthsCovered(draftBalance, avgSpend);
  const ratio = progressRatio(draftBalance, target);
  const eta = monthsToGoal(draftBalance, target, draftContribution);
  const left = Math.max(0, target - draftBalance);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const balance = parseAmount(balanceInput);
    if (balance == null) {
      showNotification(t('goals.invalidBalance'), notificationType.ERROR);
      return;
    }
    const customRaw = customTargetInput.trim();
    const customTarget =
      customRaw === '' ? null : parseAmount(customTargetInput);
    if (customRaw !== '' && customTarget == null) {
      showNotification(t('goals.invalidTarget'), notificationType.ERROR);
      return;
    }
    const contribRaw = contributionInput.trim();
    const monthlyContribution =
      contribRaw === '' ? null : parseAmount(contributionInput);
    if (contribRaw !== '' && monthlyContribution == null) {
      showNotification(t('goals.invalidContribution'), notificationType.ERROR);
      return;
    }

    setSaving(true);
    setSyncStatus('syncing');
    try {
      const next = setEmergencyFund({
        balance,
        targetMonths,
        customTarget,
        monthlyContribution,
      });
      if (!navigator.onLine) {
        setSyncStatus('offline');
        showNotification(t('goals.savedOffline'), notificationType.SUCCESS);
        return;
      }
      const uid = requireSessionUid();
      await saveGoalsToDrive(uid, { fund: next, enabled: goalsEnabled });
      setSyncStatus('synced');
      showNotification(t('goals.savedDrive'), notificationType.SUCCESS);
    } catch (err) {
      setSyncStatus('error');
      const message =
        err instanceof DriveError
          ? t('goals.syncErrorDrive')
          : t('goals.syncError');
      showNotification(message, notificationType.ERROR);
    } finally {
      setSaving(false);
    }
  };

  const coverageLabel =
    avgSpend > 0
      ? t('goals.monthsCoveredValue').replace(
          '{months}',
          formatNumber(Number(covered.toFixed(1)))
        )
      : t('goals.noSpendHistory');

  const etaLabel =
    eta == null
      ? t('goals.etaUnknown')
      : eta === 0
        ? t('goals.goalReached')
        : t('goals.etaMonths').replace(
            '{months}',
            formatNumber(Number(eta.toFixed(1)))
          );

  const syncLabel =
    syncStatus === 'syncing'
      ? t('goals.syncing')
      : syncStatus === 'synced'
        ? t('goals.synced')
        : syncStatus === 'offline'
          ? t('goals.offline')
          : syncStatus === 'error'
            ? t('goals.syncFailed')
            : null;

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
      />

      <Card
        variant="surface"
        padding="lg"
        className="mb-5 flex flex-col gap-4 border-[var(--color-border-subtle)] shadow-[0_8px_28px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-micro text-app-muted m-0 uppercase tracking-widest">
              {t('goals.currentBalance')}
            </p>
            <p
              className="tabular-nums text-app-primary m-0 mt-1 font-extrabold tracking-tight leading-[1.05] break-words"
              style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}
            >
              {formatNumber(draftBalance)}
            </p>
            <p className="m-0 mt-2 text-caption text-app-secondary/90">
              {coverageLabel}
            </p>
          </div>
          <ProgressRing
            value={ratio * 100}
            max={100}
            size={72}
            strokeWidth={5}
            label={t('goals.progress')}
          />
        </div>
        {target > 0 && (
          <p className="m-0 flex items-center gap-2 text-caption text-app-muted">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-app-accent)] shrink-0"
              aria-hidden
            />
            {t('goals.ofTarget')
              .replace('{left}', formatNumber(left))
              .replace('{target}', formatNumber(target))}
          </p>
        )}
        {syncLabel && (
          <p
            className={cn(
              'm-0 flex items-center gap-2 text-caption',
              syncStatus === 'error' || syncStatus === 'offline'
                ? 'text-app-muted'
                : 'text-[color-mix(in_srgb,var(--color-income)_85%,white)]'
            )}
          >
            {syncStatus === 'syncing' ? (
              <FiLoader className="animate-spin shrink-0" aria-hidden />
            ) : syncStatus === 'error' || syncStatus === 'offline' ? (
              <FiCloudOff className="shrink-0" aria-hidden />
            ) : (
              <FiCloud className="shrink-0" aria-hidden />
            )}
            {syncLabel}
          </p>
        )}
      </Card>

      <StatsGrid columns={2} className="gap-2 mb-4 sm:gap-2">
        <StatCard
          value={target > 0 ? formatNumber(target) : '—'}
          label={t('goals.target')}
        />
        <StatCard
          value={avgSpend > 0 ? formatNumber(Number(avgSpend.toFixed(0))) : '—'}
          label={t('goals.avgMonthlySpend')}
        />
        <StatCard
          value={
            avgSpend > 0 ? formatNumber(Number(covered.toFixed(1))) : '—'
          }
          label={t('goals.monthsCovered')}
        />
        <StatCard value={etaLabel} label={t('goals.eta')} />
      </StatsGrid>

      <SettingsSection
        title={t('goals.editTitle')}
        description={t('goals.editDescription')}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <AmountField
            id="goals-balance"
            name="balance"
            label={t('goals.balanceLabel')}
            hint={t('goals.balanceHint')}
            value={balanceInput}
            onChange={setBalanceInput}
            currency={currency}
            icon={FiShield}
            required
            size="lg"
          />

          <div>
            <p className="m-0 mb-2 flex items-center gap-2 text-micro font-semibold uppercase tracking-widest text-app-muted">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] text-[var(--color-app-accent)]">
                <FiCalendar className="h-3.5 w-3.5" aria-hidden />
              </span>
              {t('goals.targetMonths')}
            </p>
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-white/12',
                'bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-[color-mix(in_srgb,var(--color-app-accent)_10%,transparent)]',
                'shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
              )}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                aria-hidden
              />
              <div className="flex gap-2 p-3 sm:p-3.5">
                {TARGET_MONTH_OPTIONS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setTargetMonths(months)}
                    className={cn(
                      'flex-1 min-h-12 rounded-xl border text-sm font-semibold transition-all',
                      targetMonths === months
                        ? 'border-[var(--color-app-accent)] bg-[color-mix(in_srgb,var(--color-app-accent)_22%,transparent)] text-app-primary shadow-[0_0_0_1px_var(--color-input-focus-ring)]'
                        : 'border-white/10 bg-black/10 text-app-muted hover:border-white/20 hover:text-app-secondary'
                    )}
                  >
                    {t('goals.nMonths').replace('{n}', String(months))}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
                <span className="text-caption text-app-muted">
                  {draftCustomTarget != null && draftCustomTarget > 0
                    ? t('goals.customTargetActive')
                    : avgSpend > 0
                      ? t('goals.suggestedTarget').replace(
                          '{amount}',
                          formatNumber(
                            Number((avgSpend * targetMonths).toFixed(0))
                          )
                        )
                      : t('goals.targetMonthsDriveHint')}
                </span>
              </div>
            </div>
          </div>

          <AmountField
            id="goals-custom-target"
            name="customTarget"
            label={t('goals.customTargetLabel')}
            hint={t('goals.customTargetHint')}
            value={customTargetInput}
            onChange={setCustomTargetInput}
            currency={currency}
            icon={FiFlag}
            placeholder={t('goals.customTargetPlaceholder')}
          />

          <AmountField
            id="goals-contribution"
            name="contribution"
            label={t('goals.contributionLabel')}
            hint={t('goals.contributionHint')}
            value={contributionInput}
            onChange={setContributionInput}
            currency={currency}
            icon={FiPlusCircle}
            placeholder={t('goals.contributionPlaceholder')}
          />

          <button
            type="submit"
            disabled={saving}
            className={BTN_SUBMIT_CLASS}
          >
            {saving ? (
              <FiLoader className="animate-spin" aria-hidden />
            ) : (
              <FiShield aria-hidden />
            )}
            {saving ? t('goals.saving') : t('goals.save')}
          </button>
        </form>
      </SettingsSection>
    </div>
  );
};

export default Goals;
