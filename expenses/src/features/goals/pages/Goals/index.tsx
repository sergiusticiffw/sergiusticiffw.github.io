import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  FiEdit2,
  FiLoader,
  FiPieChart,
  FiPlus,
  FiPlusCircle,
  FiSettings,
  FiZap,
} from 'react-icons/fi';
import { useExpenseData } from '@stores/expenseStore';
import {
  useGoalsEnabled,
  useNetWorthEnabled,
  useSettingsCurrency,
} from '@stores/settingsStore';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import {
  DeleteConfirmDrawer,
  FormField,
  StatCard,
  StatsGrid,
} from '@shared/components/Common';
import VaulDrawer from '@shared/components/VaulDrawer';
import { cn } from '@shared/ui';
import {
  PAGE_CONTAINER_CLASS,
  BTN_SUBMIT_CLASS,
  FAB_CLASS,
} from '@shared/utils/layoutClasses';
import { formatNumber } from '@shared/utils/utils';
import { notificationType } from '@shared/utils/constants';
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
  removeEmergencyFundContribution,
  setEmergencyFund,
  updateEmergencyFundContribution,
  useEmergencyFund,
} from '../../store';
import { persistGoalsToSupabase } from '../../../profile/preferencesSync';
import { getDataProviderKind } from '../../../../data';
import { getMonthNames } from '@shared/utils/constants';

const sectionTitleClass =
  'm-0 mb-3 text-xs font-semibold uppercase tracking-wider text-white/50';
const panelClass =
  'rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden';
const ghostLinkClass =
  'inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-white/55 no-underline hover:text-[var(--color-app-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-app-accent)]';

const Goals = () => {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const showNotification = useNotification();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const netWorthEnabled = useNetWorthEnabled();
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
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const progressPct = Math.max(0, Math.min(100, ratio * 100));
  const eta = monthsToGoal(balance, target, draftContribution);
  const left = Math.max(0, target - balance);

  /** Silent account persist (Supabase prefs). Local store already saved. */
  const persistFundToCloud = async (next: typeof fund) => {
    if (!navigator.onLine) return false;
    if (getDataProviderKind() !== 'supabase') return false;
    return persistGoalsToSupabase({
      fund: next,
      enabled: goalsEnabled,
    });
  };

  const openAddMovement = () => {
    setAddAmountInput('');
    setAddMonth(currentMonthKey());
    setAddOpen(true);
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
    try {
      const next = addEmergencyFundContribution(amount, addMonth);
      setAddAmountInput('');
      setAddOpen(false);
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
    // Must call: setState(fn) treats a bare function as an updater.
    setEditMonth(currentMonthKey());
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
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteContribution = async () => {
    if (!deleteId) return;
    setDeleting(true);
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
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setDeleting(false);
    }
  };

  const deletePreview = useMemo(() => {
    if (!deleteId) return null;
    const entry = (fund.contributions ?? []).find(
      (item) => item.id === deleteId
    );
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
    try {
      const next = setEmergencyFund({
        targetMonths,
        monthlyContribution,
      });
      setSettingsOpen(false);
      const synced = await persistFundToCloud(next);
      showNotification(
        synced ? t('goals.savedDrive') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
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

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div className="mb-5 pt-4 flex flex-col items-stretch">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-white text-left">
          {t('goals.title')}
        </h1>
        <p className="m-0 mt-1 text-sm text-white/50 text-left">
          {t('goals.subtitle')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {netWorthEnabled && (
            <>
              <Link to="/expenses/net-worth" className={ghostLinkClass}>
                <FiPieChart className="size-3.5 shrink-0" aria-hidden />
                <span>{t('goals.openNetWorth')}</span>
              </Link>
              <span className="text-white/20" aria-hidden>
                ·
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={ghostLinkClass}
          >
            <FiSettings className="size-3.5 shrink-0" aria-hidden />
            <span>{t('goals.settingsShort')}</span>
          </button>
          <span className="text-white/20" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/expenses/assistant',
                state: { prompt: t('goals.askAiPrompt') },
              })
            }
            className={ghostLinkClass}
          >
            <FiZap className="size-3.5 shrink-0" aria-hidden />
            <span>{t('goals.askAiShort')}</span>
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 pb-5 shadow-lg">
        <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          {t('goals.currentBalance')}
        </h2>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums sm:text-3xl">
              {formatNumber(balance)}
            </span>
            <span className="ml-2 text-sm font-medium text-white/45">
              {currency}
            </span>
          </div>
          <span className="mb-1 shrink-0 text-2xl font-bold tabular-nums text-white/70 sm:text-xl">
            {formatNumber(Number(progressPct.toFixed(0)))}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('goals.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          className="h-3 w-full overflow-hidden rounded-md bg-black/20 shadow-inner"
        >
          <div
            className="h-full rounded-md bg-gradient-to-r from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="m-0 mt-3 text-sm text-white/55">{coverageLabel}</p>
        {target > 0 && (
          <p className="m-0 mt-2 text-caption text-white/45">
            {t('goals.ofTarget')
              .replace('{left}', formatNumber(left))
              .replace('{target}', formatNumber(target))}
          </p>
        )}
      </div>

      <StatsGrid columns={2} className="mb-4 gap-2 sm:gap-2">
        <StatCard
          value={target > 0 ? formatNumber(target) : '—'}
          label={t('goals.target')}
        />
        <StatCard
          value={avgSpend > 0 ? formatNumber(Number(avgSpend.toFixed(0))) : '—'}
          label={t('goals.avgMonthlySpend')}
        />
        <StatCard
          value={avgSpend > 0 ? formatNumber(Number(covered.toFixed(1))) : '—'}
          label={t('goals.monthsCovered')}
        />
        <StatCard value={etaLabel} label={t('goals.eta')} />
      </StatsGrid>
      <p className="m-0 mb-5 text-caption leading-relaxed text-app-muted">
        {t('goals.excludedCategories').replace(
          '{categories}',
          NON_ESSENTIAL_CATEGORY_LABEL_KEYS.map((key) => t(key)).join(', ')
        )}
      </p>

      <section className="mb-6">
        <h2 className={sectionTitleClass}>{t('goals.historyTitle')}</h2>
        <div className={panelClass}>
          <ContributionHistory
            groups={historyByMonth}
            monthNames={monthNames}
            currency={currency}
            onEdit={openEditContribution}
            onDelete={setDeleteId}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={openAddMovement}
        className={FAB_CLASS}
        title={t('goals.addSaving')}
        aria-label={t('goals.addSaving')}
      >
        <FiPlus aria-hidden />
      </button>

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
        show={addOpen}
        onClose={(e) => {
          e?.preventDefault();
          setAddOpen(false);
        }}
        title={t('goals.addSavingTitle')}
        footer={
          <button
            type="submit"
            form="goals-add-contribution-form"
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
        }
      >
        <p className="m-0 mb-4 text-sm text-app-muted">
          {t('goals.addSavingDescription')}
        </p>
        <form
          id="goals-add-contribution-form"
          onSubmit={handleAddSaving}
          className="flex flex-col"
        >
          <FormField
            id="goals-add-amount"
            name="addAmount"
            type="number"
            label={`${t('goals.addSavingAmount')} (${currency})`}
            value={addAmountInput}
            onChange={(e) => setAddAmountInput(e.target.value)}
            step={0.01}
            inputMode="decimal"
            placeholder="0"
            ariaLabel={t('goals.addSavingAmount')}
          />
          <p className="m-0 -mt-2 mb-4 text-caption text-app-muted">
            {t('goals.addSavingAmountHint')}
          </p>
          <div className="form-group required">
            <label htmlFor="goals-add-month">{t('goals.addSavingMonth')}</label>
            <div className="input-wrapper">
              <input
                id="goals-add-month"
                name="addMonth"
                type="month"
                value={addMonth}
                onChange={(e) => setAddMonth(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
        </form>
      </VaulDrawer>

      <VaulDrawer
        show={settingsOpen}
        onClose={(e) => {
          e?.preventDefault();
          setSettingsOpen(false);
        }}
        title={t('goals.editTitle')}
        footer={
          <button
            type="submit"
            form="goals-settings-form"
            disabled={saving}
            className={BTN_SUBMIT_CLASS}
          >
            {saving ? (
              <FiLoader className="animate-spin" aria-hidden />
            ) : (
              <FiSettings aria-hidden />
            )}
            {saving ? t('goals.saving') : t('goals.save')}
          </button>
        }
      >
        <p className="m-0 mb-4 text-sm text-app-muted">
          {t('goals.editDescription')}
        </p>
        <form
          id="goals-settings-form"
          onSubmit={handleSave}
          className="flex flex-col"
        >
          <div className="form-group">
            <label id="goals-target-months-label">
              {t('goals.targetMonths')}
            </label>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-labelledby="goals-target-months-label"
            >
              {TARGET_MONTH_OPTIONS.map((months) => {
                const active = targetMonths === months;
                return (
                  <button
                    key={months}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTargetMonths(months)}
                    className={cn(
                      'min-h-11 rounded-xl border px-2 py-2 text-center text-sm font-semibold leading-tight transition-colors',
                      active
                        ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15 text-app-primary'
                        : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                    )}
                  >
                    {t('goals.nMonths').replace('{n}', String(months))}
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-caption text-app-muted">
              {avgSpend > 0
                ? t('goals.suggestedTarget').replace(
                    '{amount}',
                    formatNumber(Number((avgSpend * targetMonths).toFixed(0)))
                  )
                : t('goals.targetMonthsDriveHint')}
            </p>
          </div>

          <FormField
            id="goals-contribution"
            name="contribution"
            type="number"
            label={`${t('goals.contributionLabel')} (${currency})`}
            value={contributionInput}
            onChange={(e) => setContributionInput(e.target.value)}
            step={0.01}
            min={0}
            inputMode="decimal"
            placeholder={t('goals.contributionPlaceholder')}
            ariaLabel={t('goals.contributionLabel')}
          />
          <p className="m-0 -mt-2 text-caption text-app-muted">
            {t('goals.contributionHint')}
          </p>
        </form>
      </VaulDrawer>

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
          className="flex flex-col"
        >
          <FormField
            id="goals-edit-amount"
            name="editAmount"
            type="number"
            label={`${t('goals.addSavingAmount')} (${currency})`}
            value={editAmountInput}
            onChange={(e) => setEditAmountInput(e.target.value)}
            step={0.01}
            inputMode="decimal"
            placeholder="0"
            ariaLabel={t('goals.addSavingAmount')}
          />
          <p className="m-0 -mt-2 mb-4 text-caption text-app-muted">
            {t('goals.addSavingAmountHint')}
          </p>
          <div className="form-group required">
            <label htmlFor="goals-edit-month">{t('goals.addSavingMonth')}</label>
            <div className="input-wrapper">
              <input
                id="goals-edit-month"
                name="editMonth"
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
        </form>
      </VaulDrawer>
    </div>
  );
};

export default Goals;
