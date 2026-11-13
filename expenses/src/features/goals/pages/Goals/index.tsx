import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar,
  FiCloud,
  FiCloudOff,
  FiEdit2,
  FiLoader,
  FiPlusCircle,
  FiShield,
} from 'react-icons/fi';
import { useExpenseData } from '@stores/expenseStore';
import {
  useGoalsEnabled,
  useSettingsCurrency,
} from '@stores/settingsStore';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import {
  DeleteConfirmDrawer,
  PageHeader,
  StatCard,
  StatsGrid,
} from '@shared/components/Common';
import VaulDrawer from '@shared/components/VaulDrawer';
import { Card, ProgressRing, SettingsSection, cn } from '@shared/ui';
import { PAGE_CONTAINER_CLASS, BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { formatNumber } from '@shared/utils/utils';
import { notificationType } from '@shared/utils/constants';
import { AmountField } from '../../components/AmountField';
import ContributionHistory from '../../components/ContributionHistory';
import {
  NON_ESSENTIAL_CATEGORY_LABEL_KEYS,
  TARGET_MONTH_OPTIONS,
  TargetMonths,
  averageMonthlySpend,
  currentMonthKey,
  groupContributionsByMonth,
  monthsCovered,
  monthsToGoal,
  parseAmount,
  parseLedgerAmount,
  progressRatio,
  resolveTarget,
} from '../../model';
import {
  addEmergencyFundContribution,
  getEmergencyFund,
  removeEmergencyFundContribution,
  replaceEmergencyFund,
  setEmergencyFund,
  updateEmergencyFundContribution,
  useEmergencyFund,
} from '../../store';
import { persistGoalsToSupabase } from '../../../profile/preferencesSync';
import { getDataProviderKind } from '../../../../data';
import { getMonthNames } from '@shared/utils/constants';

type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'local'
  | 'error'
  | 'offline';

const Goals = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const fund = useEmergencyFund();
  const { data, dataDispatch } = useExpenseData();
  const apiClient = useApiClient();
  const noData = data.groupedData === null;

  const [contributionInput, setContributionInput] = useState(
    fund.monthlyContribution != null ? String(fund.monthlyContribution) : ''
  );
  const [targetMonths, setTargetMonths] = useState<TargetMonths>(
    fund.targetMonths
  );
  const [addAmountInput, setAddAmountInput] = useState('');
  const [addMonth, setAddMonth] = useState(currentMonthKey);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmountInput, setEditAmountInput] = useState('');
  const [editMonth, setEditMonth] = useState(currentMonthKey);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const monthNames = getMonthNames();

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [noData, apiClient, dataDispatch]);

  useEffect(() => {
    setContributionInput(
      fund.monthlyContribution != null ? String(fund.monthlyContribution) : ''
    );
    setTargetMonths(fund.targetMonths);
  }, [fund.monthlyContribution, fund.targetMonths]);

  // Mark sync status from provider (prefs already pulled at login for Supabase).
  useEffect(() => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    if (getDataProviderKind() === 'supabase') {
      setSyncStatus('synced');
    } else {
      setSyncStatus('local');
    }
  }, []);

  /** Push Goals to Supabase profiles.preferences. */
  const handleSyncCloud = async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      showNotification(t('goals.savedOffline'), notificationType.SUCCESS);
      return;
    }
    if (getDataProviderKind() !== 'supabase') {
      setSyncStatus('local');
      showNotification(t('goals.localOnly'), notificationType.SUCCESS);
      return;
    }
    setSyncStatus('syncing');
    try {
      const ok = await persistGoalsToSupabase({
        fund: getEmergencyFund(),
        enabled: goalsEnabled,
      });
      setSyncStatus(ok ? 'synced' : 'local');
      showNotification(
        ok ? t('goals.synced') : t('goals.localOnly'),
        notificationType.SUCCESS
      );
    } catch {
      setSyncStatus('error');
      showNotification(t('goals.syncError'), notificationType.ERROR);
    }
  };

  const avgSpend = useMemo(
    () => averageMonthlySpend(data.raw ?? []),
    [data.raw]
  );

  const historyByMonth = useMemo(
    () => groupContributionsByMonth(fund.contributions ?? []),
    [fund.contributions]
  );

  const draftContribution = parseAmount(contributionInput);
  const balance = fund.balance ?? 0;

  const draftFund = {
    ...fund,
    targetMonths,
    monthlyContribution: draftContribution,
  };

  const target = resolveTarget(draftFund, avgSpend);
  const covered = monthsCovered(balance, avgSpend);
  const ratio = progressRatio(balance, target);
  const eta = monthsToGoal(balance, target, draftContribution);
  const left = Math.max(0, target - balance);

  const persistFundToCloud = async (next: typeof fund) => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return false;
    }
    if (getDataProviderKind() !== 'supabase') {
      setSyncStatus('local');
      return false;
    }
    const ok = await persistGoalsToSupabase({
      fund: next,
      enabled: goalsEnabled,
    });
    setSyncStatus(ok ? 'synced' : 'local');
    return ok;
  };

  const handleAddSaving = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseLedgerAmount(addAmountInput);
    if (amount == null) {
      showNotification(t('goals.invalidAddAmount'), notificationType.ERROR);
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(addMonth)) {
      showNotification(t('goals.invalidAddAmount'), notificationType.ERROR);
      return;
    }

    setAdding(true);
    setSyncStatus('syncing');
    try {
      const next = addEmergencyFundContribution(amount, addMonth);
      setAddAmountInput('');
      const synced = await persistFundToCloud(next);
      showNotification(
        synced
          ? amount < 0
            ? t('goals.addWithdrawalDone')
            : t('goals.addSavingDone')
          : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
      setSyncStatus('error');
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setAdding(false);
    }
  };

  const openEditContribution = (id: string) => {
    const entry = (fund.contributions ?? []).find((item) => item.id === id);
    if (!entry) return;
    setEditId(id);
    setEditAmountInput(String(entry.amount));
    setEditMonth(entry.month);
  };

  const closeEditContribution = () => {
    setEditId(null);
    setEditAmountInput('');
    setEditMonth(currentMonthKey);
  };

  const handleEditContribution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editId) return;
    const amount = parseLedgerAmount(editAmountInput);
    if (amount == null) {
      showNotification(t('goals.invalidAddAmount'), notificationType.ERROR);
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(editMonth)) {
      showNotification(t('goals.invalidAddAmount'), notificationType.ERROR);
      return;
    }

    setEditing(true);
    setSyncStatus('syncing');
    try {
      const next = updateEmergencyFundContribution(editId, {
        amount,
        month: editMonth,
      });
      if (!next) {
        showNotification(t('goals.syncError'), notificationType.ERROR);
        return;
      }
      closeEditContribution();
      const synced = await persistFundToCloud(next);
      showNotification(
        synced ? t('goals.editContributionDone') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
      setSyncStatus('error');
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteContribution = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setSyncStatus('syncing');
    try {
      const next = removeEmergencyFundContribution(deleteId);
      if (!next) {
        showNotification(t('goals.syncError'), notificationType.ERROR);
        return;
      }
      setDeleteId(null);
      const synced = await persistFundToCloud(next);
      showNotification(
        synced ? t('goals.deleteContributionDone') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
      setSyncStatus('error');
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setDeleting(false);
    }
  };

  const deletePreview = useMemo(() => {
    if (!deleteId) return null;
    const entry = (fund.contributions ?? []).find((item) => item.id === deleteId);
    if (!entry) return null;
    return {
      variant: 'payment' as const,
      dt: entry.createdAt,
      dsc: entry.month,
      sum: entry.amount,
    };
  }, [deleteId, fund.contributions]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
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
        targetMonths,
        monthlyContribution,
      });
      const synced = await persistFundToCloud(next);
      showNotification(
        synced ? t('goals.savedDrive') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
      setSyncStatus('error');
      showNotification(t('goals.syncError'), notificationType.ERROR);
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
        : syncStatus === 'local'
          ? t('goals.localOnly')
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
              {formatNumber(balance)}
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
          <div className="flex items-center justify-between gap-3">
            <p
              className={cn(
                'm-0 flex items-center gap-2 text-caption',
                syncStatus === 'error' ||
                  syncStatus === 'offline' ||
                  syncStatus === 'local'
                  ? 'text-app-muted'
                  : 'text-[color-mix(in_srgb,var(--color-income)_85%,white)]'
              )}
            >
              {syncStatus === 'syncing' ? (
                <FiLoader className="animate-spin shrink-0" aria-hidden />
              ) : syncStatus === 'error' ||
                syncStatus === 'offline' ||
                syncStatus === 'local' ? (
                <FiCloudOff className="shrink-0" aria-hidden />
              ) : (
                <FiCloud className="shrink-0" aria-hidden />
              )}
              {syncLabel}
            </p>
            {(syncStatus === 'local' ||
              syncStatus === 'error' ||
              syncStatus === 'offline' ||
              syncStatus === 'synced') && (
              <button
                type="button"
                onClick={handleSyncCloud}
                className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-caption font-semibold text-app-secondary hover:border-white/25 hover:text-app-primary"
              >
                {t('goals.syncNow')}
              </button>
            )}
          </div>
        )}
      </Card>

      <StatsGrid columns={2} className="gap-2 mb-2 sm:gap-2">
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
      <p className="m-0 mb-5 text-caption text-app-muted leading-relaxed">
        {t('goals.excludedCategories').replace(
          '{categories}',
          NON_ESSENTIAL_CATEGORY_LABEL_KEYS.map((key) => t(key)).join(', ')
        )}
      </p>

      <SettingsSection
        title={t('goals.addSavingTitle')}
        description={t('goals.addSavingDescription')}
      >
        <form onSubmit={handleAddSaving} className="flex flex-col gap-4">
          <AmountField
            id="goals-add-amount"
            name="addAmount"
            label={t('goals.addSavingAmount')}
            hint={t('goals.addSavingAmountHint')}
            value={addAmountInput}
            onChange={setAddAmountInput}
            currency={currency}
            icon={FiPlusCircle}
            size="lg"
            allowNegative
          />
          <div>
            <label
              htmlFor="goals-add-month"
              className="m-0 mb-2 flex items-center gap-2 text-micro font-semibold uppercase tracking-widest text-app-muted"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] text-[var(--color-app-accent)]">
                <FiCalendar className="h-3.5 w-3.5" aria-hidden />
              </span>
              {t('goals.addSavingMonth')}
            </label>
            <input
              id="goals-add-month"
              name="addMonth"
              type="month"
              value={addMonth}
              onChange={(e) => setAddMonth(e.target.value)}
              className="form-input w-full"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className={BTN_SUBMIT_CLASS}
          >
            {adding ? (
              <FiLoader className="animate-spin" aria-hidden />
            ) : (
              <FiPlusCircle aria-hidden />
            )}
            {adding ? t('goals.addSavingBusy') : t('goals.addSaving')}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection title={t('goals.historyTitle')}>
        <ContributionHistory
          groups={historyByMonth}
          monthNames={monthNames}
          currency={currency}
          onEdit={openEditContribution}
          onDelete={setDeleteId}
        />
      </SettingsSection>

      <SettingsSection
        title={t('goals.editTitle')}
        description={t('goals.editDescription')}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-5">
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
                  {avgSpend > 0
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

      <DeleteConfirmDrawer
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteContribution}
        title={t('goals.deleteContributionTitle')}
        message={t('goals.deleteContributionMessage')}
        isSubmitting={deleting}
        item={deletePreview}
      />

      <VaulDrawer
        show={!!editId}
        onClose={(e) => {
          e?.preventDefault();
          closeEditContribution();
        }}
        title={t('goals.editContributionTitle')}
        footer={
          <button
            type="submit"
            form="goals-edit-contribution-form"
            disabled={editing}
            className={BTN_SUBMIT_CLASS}
          >
            {editing ? (
              <FiLoader className="animate-spin" aria-hidden />
            ) : (
              <FiEdit2 aria-hidden />
            )}
            {editing ? t('goals.saving') : t('goals.editContributionSave')}
          </button>
        }
      >
        <form
          id="goals-edit-contribution-form"
          onSubmit={handleEditContribution}
          className="flex flex-col gap-4"
        >
          <AmountField
            id="goals-edit-amount"
            name="editAmount"
            label={t('goals.addSavingAmount')}
            hint={t('goals.addSavingAmountHint')}
            value={editAmountInput}
            onChange={setEditAmountInput}
            currency={currency}
            icon={FiPlusCircle}
            size="lg"
            allowNegative
          />
          <div>
            <label
              htmlFor="goals-edit-month"
              className="m-0 mb-2 flex items-center gap-2 text-micro font-semibold uppercase tracking-widest text-app-muted"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] text-[var(--color-app-accent)]">
                <FiCalendar className="h-3.5 w-3.5" aria-hidden />
              </span>
              {t('goals.addSavingMonth')}
            </label>
            <input
              id="goals-edit-month"
              name="editMonth"
              type="month"
              value={editMonth}
              onChange={(e) => setEditMonth(e.target.value)}
              className="form-input w-full"
              required
            />
          </div>
        </form>
      </VaulDrawer>
    </div>
  );
};

export default Goals;
