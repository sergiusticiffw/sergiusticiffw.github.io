import { useEffect, useMemo, useState } from 'react';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useLocalization } from '@shared/context/localization';
import { useLoan } from '@stores/loanStore';
import { Switch } from '@shared/ui';
import { formatNumber, getLocale, getLoanStatus } from '@shared/utils/utils';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import {
  getLoanSimulator,
  type ExtraStrategy,
} from '../../../../ai/loanScenarios';
import {
  type CompareLoanRow,
  type CompareMetrics,
  type FinishByResult,
  type RateResult,
  type RecurringResult,
  type SimulateMode,
  compareLoansForExtra,
  runOneTimeExtra,
  runRateChange,
  runRecurringExtra,
  solveFinishBy,
} from '../../utils/loanSimulateUi';

type LoanSimulateDrawerProps = {
  show: boolean;
  onClose: () => void;
  loan: ApiLoan;
  payments: ApiPaymentItem[];
};

const EVERY_OPTIONS = [1, 3, 12] as const;

const formatIsoDate = (iso: string | null | undefined, locale: string) => {
  if (!iso) return '-';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const parseAmount = (raw: string) => {
  const amount = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const parseRate = (raw: string) => {
  const rate = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
};

/**
 * What-if drawer for one loan. Modes reuse LoanSimulator (same engine as AI tools).
 * Nothing is written anywhere.
 */
const LoanSimulateDrawer = ({
  show,
  onClose,
  loan,
  payments,
}: LoanSimulateDrawerProps) => {
  const { t, language } = useLocalization();
  const locale = getLocale(language);
  const { data: loanData } = useLoan();

  const simulator = useMemo(
    () => getLoanSimulator({ loan, items: payments }),
    [loan, payments]
  );

  const activeLoanCount = useMemo(() => {
    const list = loanData.loans || [];
    return list.filter(
      (item) => getLoanStatus(item.fls as string | undefined) === 'active'
    ).length;
  }, [loanData.loans]);

  const modes = useMemo(() => {
    const base: { id: SimulateMode; label: string }[] = [
      { id: 'one_time', label: t('simulate.mode.oneTime') },
      { id: 'recurring', label: t('simulate.mode.recurring') },
      { id: 'rate', label: t('simulate.mode.rate') },
      { id: 'finish_by', label: t('simulate.mode.finishBy') },
    ];
    if (activeLoanCount > 1) {
      base.push({ id: 'compare', label: t('simulate.mode.compare') });
    }
    return base;
  }, [t, activeLoanCount]);

  const [mode, setMode] = useState<SimulateMode>('one_time');
  const [amountInput, setAmountInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [strategy, setStrategy] = useState<ExtraStrategy>('reduce_term');
  const [everyMonths, setEveryMonths] = useState<(typeof EVERY_OPTIONS)[number]>(1);
  const [rateInput, setRateInput] = useState('');
  const [keepInstallment, setKeepInstallment] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [targetDateInput, setTargetDateInput] = useState('');
  const [finishMethod, setFinishMethod] = useState<'monthly_extra' | 'one_time'>(
    'monthly_extra'
  );

  const date = dateInput || simulator?.defaultDate() || '';
  const amount = parseAmount(amountInput);
  const rate = parseRate(rateInput);
  const fee = parseAmount(feeInput) ?? 0;
  const dateInTerm = Boolean(
    simulator && date >= simulator.startIso && date <= simulator.endIso
  );
  const targetDate = targetDateInput;

  useEffect(() => {
    if (mode === 'compare' && activeLoanCount < 2) {
      setMode('one_time');
    }
  }, [mode, activeLoanCount]);

  const run = useMemo((): {
    metrics: CompareMetrics | null;
    recurring: RecurringResult | null;
    rateResult: RateResult | null;
    finish: FinishByResult | null;
    compareRows: CompareLoanRow[];
    error: string | null;
    prompt: string | null;
  } => {
    if (!simulator) {
      return {
        metrics: null,
        recurring: null,
        rateResult: null,
        finish: null,
        compareRows: [],
        error: null,
        prompt: null,
      };
    }

    try {
      if (mode === 'one_time') {
        if (!amount) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.enterAmount'),
          };
        }
        if (!dateInTerm) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.outsideTerm'),
          };
        }
        return {
          metrics: runOneTimeExtra(simulator, amount, date, strategy),
          recurring: null,
          rateResult: null,
          finish: null,
          compareRows: [],
          error: null,
          prompt: null,
        };
      }

      if (mode === 'recurring') {
        if (!amount) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.enterAmount'),
          };
        }
        if (!dateInTerm) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.outsideTerm'),
          };
        }
        const recurring = runRecurringExtra(
          simulator,
          amount,
          everyMonths,
          date,
          null
        );
        if (!recurring) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.noInstallmentsLeft'),
          };
        }
        return {
          metrics: recurring,
          recurring,
          rateResult: null,
          finish: null,
          compareRows: [],
          error: null,
          prompt: null,
        };
      }

      if (mode === 'rate') {
        if (rate == null) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.enterRate'),
          };
        }
        if (!dateInTerm) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.outsideTerm'),
          };
        }
        const rateResult = runRateChange(
          simulator,
          rate,
          date,
          keepInstallment,
          fee
        );
        return {
          metrics: rateResult,
          recurring: null,
          rateResult,
          finish: null,
          compareRows: [],
          error: null,
          prompt: null,
        };
      }

      if (mode === 'finish_by') {
        if (!targetDate || targetDate < simulator.startIso) {
          return {
            metrics: null,
            recurring: null,
            rateResult: null,
            finish: null,
            compareRows: [],
            error: null,
            prompt: t('simulate.enterTargetDate'),
          };
        }
        const from = dateInTerm ? date : simulator.defaultDate();
        const finish = solveFinishBy(simulator, targetDate, finishMethod, from);
        return {
          metrics: finish.metrics,
          recurring: null,
          rateResult: null,
          finish,
          compareRows: [],
          error: null,
          prompt: null,
        };
      }

      // compare
      if (!amount) {
        return {
          metrics: null,
          recurring: null,
          rateResult: null,
          finish: null,
          compareRows: [],
          error: null,
          prompt: t('simulate.enterAmount'),
        };
      }
      const compareRows = compareLoansForExtra(
        amount,
        dateInput || undefined,
        String(loan.id),
        loanData.loans || [],
        (loanData.payments || []) as LoanPaymentsEntry[]
      );
      return {
        metrics: null,
        recurring: null,
        rateResult: null,
        finish: null,
        compareRows,
        error: null,
        prompt: compareRows.length ? null : t('simulate.compareEmpty'),
      };
    } catch {
      return {
        metrics: null,
        recurring: null,
        rateResult: null,
        finish: null,
        compareRows: [],
        error: t('simulate.error'),
        prompt: null,
      };
    }
  }, [
    simulator,
    mode,
    amount,
    date,
    dateInTerm,
    strategy,
    everyMonths,
    rate,
    keepInstallment,
    fee,
    targetDate,
    finishMethod,
    dateInput,
    loan.id,
    loanData.loans,
    loanData.payments,
    t,
  ]);

  if (!simulator) {
    return (
      <VaulDrawer show={show} onClose={onClose} title={t('simulate.title')}>
        <p className="m-0 text-sm text-app-muted">{t('simulate.unavailable')}</p>
      </VaulDrawer>
    );
  }

  const { metrics, recurring, rateResult, finish, compareRows, error, prompt } =
    run;

  const strategyOptions: {
    value: ExtraStrategy;
    label: string;
    desc: string;
  }[] = [
    {
      value: 'reduce_term',
      label: t('simulate.shorterTerm'),
      desc: t('simulate.shorterTermDesc'),
    },
    {
      value: 'reduce_installment',
      label: t('simulate.lowerInstallment'),
      desc: t('simulate.lowerInstallmentDesc'),
    },
  ];

  const scenarioColumnLabel =
    mode === 'rate'
      ? t('simulate.withNewRate')
      : mode === 'finish_by'
        ? t('simulate.withPlan')
        : t('simulate.withExtra');

  return (
    <VaulDrawer show={show} onClose={onClose} title={t('simulate.title')}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-app-muted">{t('simulate.hint')}</p>

        <div
          role="tablist"
          aria-label={t('simulate.modes')}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {modes.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(item.id)}
                className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/20 text-app-primary'
                    : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {(mode === 'one_time' ||
          mode === 'recurring' ||
          mode === 'compare') && (
          <div className="form-group">
            <label htmlFor="simulate-amount">
              {mode === 'recurring'
                ? t('simulate.recurringAmount')
                : t('simulate.amount')}
            </label>
            <input
              id="simulate-amount"
              className="form-input"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
            />
          </div>
        )}

        {mode === 'rate' && (
          <>
            <div className="form-group">
              <label htmlFor="simulate-rate">{t('simulate.newRate')}</label>
              <input
                id="simulate-rate"
                className="form-input"
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder={String(loan.fr ?? '')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="simulate-fee">{t('simulate.refinanceFee')}</label>
              <input
                id="simulate-fee"
                className="form-input"
                type="text"
                inputMode="decimal"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-app-primary">
                  {t('simulate.keepInstallment')}
                </p>
                <p className="m-0 mt-0.5 text-xs text-app-muted">
                  {t('simulate.keepInstallmentDesc')}
                </p>
              </div>
              <Switch
                checked={keepInstallment}
                onCheckedChange={setKeepInstallment}
                aria-label={t('simulate.keepInstallment')}
              />
            </div>
          </>
        )}

        {mode === 'finish_by' && (
          <>
            <div className="form-group">
              <label htmlFor="simulate-target">
                {t('simulate.targetDate')}
              </label>
              <input
                id="simulate-target"
                className="form-input"
                type="date"
                value={targetDate}
                min={simulator.defaultDate()}
                max={simulator.endIso}
                onChange={(e) => setTargetDateInput(e.target.value)}
              />
            </div>
            <div
              role="group"
              aria-label={t('simulate.finishMethod')}
              className="grid grid-cols-2 gap-2"
            >
              {(
                [
                  {
                    value: 'monthly_extra' as const,
                    label: t('simulate.monthlyExtra'),
                    desc: t('simulate.monthlyExtraDesc'),
                  },
                  {
                    value: 'one_time' as const,
                    label: t('simulate.oneTimeExtra'),
                    desc: t('simulate.oneTimeExtraDesc'),
                  },
                ] as const
              ).map((option) => {
                const active = finishMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFinishMethod(option.value)}
                    className={`flex min-h-11 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15 text-app-primary'
                        : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-app-muted">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {mode !== 'compare' && (
          <div className="form-group">
            <label htmlFor="simulate-date">
              {mode === 'finish_by'
                ? t('simulate.fromDate')
                : mode === 'rate'
                  ? t('simulate.effectiveDate')
                  : mode === 'recurring'
                    ? t('simulate.fromDate')
                    : t('simulate.date')}
            </label>
            <input
              id="simulate-date"
              className="form-input"
              type="date"
              value={date}
              min={simulator.startIso}
              max={simulator.endIso}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>
        )}

        {mode === 'compare' && (
          <div className="form-group">
            <label htmlFor="simulate-compare-date">{t('simulate.date')}</label>
            <input
              id="simulate-compare-date"
              className="form-input"
              type="date"
              value={date}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>
        )}

        {mode === 'recurring' && (
          <div
            role="group"
            aria-label={t('simulate.everyMonths')}
            className="grid grid-cols-3 gap-2"
          >
            {EVERY_OPTIONS.map((value) => {
              const active = everyMonths === value;
              const label =
                value === 1
                  ? t('simulate.everyMonth')
                  : value === 3
                    ? t('simulate.everyQuarter')
                    : t('simulate.everyYear');
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setEveryMonths(value)}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15 text-app-primary'
                      : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {mode === 'one_time' && (
          <div
            role="group"
            aria-label={t('simulate.strategy')}
            className="grid grid-cols-2 gap-2"
          >
            {strategyOptions.map((option) => {
              const active = strategy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStrategy(option.value)}
                  className={`flex min-h-11 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15 text-app-primary'
                      : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-xs text-app-muted">{option.desc}</span>
                </button>
              );
            })}
          </div>
        )}

        {error ? (
          <p className="m-0 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : prompt ? (
          <p className="m-0 text-sm text-app-muted">{prompt}</p>
        ) : null}

        {finish && finish.alreadyMet && (
          <p className="m-0 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-200">
            {t('simulate.alreadyOnTrack')}
          </p>
        )}

        {finish && !finish.alreadyMet && !finish.feasible && (
          <p className="m-0 text-sm text-rose-300" role="alert">
            {finish.note === 'unreachable_one_time'
              ? t('simulate.unreachableOneTime')
              : t('simulate.unreachableMonthly')}
          </p>
        )}

        {finish && finish.feasible && !finish.alreadyMet && finish.requiredAmount != null && (
          <div className="rounded-xl border border-[var(--color-app-accent)]/30 bg-[var(--color-app-accent)]/10 px-3 py-3 text-sm">
            <p className="m-0 text-app-secondary">
              {finish.method === 'monthly_extra'
                ? t('simulate.requiredMonthly')
                : t('simulate.requiredOneTime')}
            </p>
            <p className="m-0 mt-1 text-lg font-semibold tabular-nums text-[var(--color-app-accent)]">
              {formatNumber(finish.requiredAmount)}
            </p>
            {finish.totalExtraPaid != null && finish.method === 'monthly_extra' && (
              <p className="m-0 mt-2 text-xs text-app-muted">
                {t('simulate.totalExtraPaid')}:{' '}
                <span className="tabular-nums text-app-primary">
                  {formatNumber(finish.totalExtraPaid)}
                </span>
              </p>
            )}
          </div>
        )}

        {recurring && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-xs text-app-muted">
                {t('simulate.extraPaymentsMade')}
              </p>
              <p className="m-0 mt-1 tabular-nums text-app-primary">
                {recurring.extraPaymentsMade}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-xs text-app-muted">
                {t('simulate.totalExtraPaid')}
              </p>
              <p className="m-0 mt-1 tabular-nums text-app-primary">
                {formatNumber(recurring.totalExtraPaid)}
              </p>
            </div>
          </div>
        )}

        {metrics && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3 text-sm">
              <span />
              <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('simulate.current')}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                {scenarioColumnLabel}
              </span>

              <span className="text-app-secondary">
                {t('simulate.totalInterest')}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatNumber(metrics.baseline.totalInterest)}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatNumber(metrics.scenario.totalInterest)}
              </span>

              <span className="text-app-secondary">
                {t('simulate.payoffDate')}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatIsoDate(metrics.baseline.payoffDate, locale)}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatIsoDate(metrics.scenario.payoffDate, locale)}
              </span>

              <span className="text-app-secondary">
                {t('simulate.nextInstallment')}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {metrics.baseNext != null ? formatNumber(metrics.baseNext) : '-'}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {metrics.scenarioNext != null
                  ? formatNumber(metrics.scenarioNext)
                  : '-'}
              </span>
            </div>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
              {metrics.interestSaved > 0 && (
                <div>
                  <span className="text-app-secondary">
                    {t('simulate.interestSaved')}:{' '}
                  </span>
                  <strong className="tabular-nums text-[var(--color-app-accent)]">
                    {formatNumber(metrics.interestSaved)}
                  </strong>
                </div>
              )}
              {metrics.monthsSaved > 0 && (
                <div>
                  <span className="text-app-secondary">
                    {t('simulate.monthsSaved')}:{' '}
                  </span>
                  <strong className="tabular-nums text-app-primary">
                    {metrics.monthsSaved}
                  </strong>
                </div>
              )}
              {rateResult && rateResult.interestChange > 0 && (
                <div>
                  <span className="text-app-secondary">
                    {t('simulate.interestIncrease')}:{' '}
                  </span>
                  <strong className="tabular-nums text-rose-300">
                    {formatNumber(rateResult.interestChange)}
                  </strong>
                </div>
              )}
              {rateResult &&
                rateResult.installmentChange != null &&
                rateResult.installmentChange !== 0 && (
                  <div>
                    <span className="text-app-secondary">
                      {t('simulate.installmentChange')}:{' '}
                    </span>
                    <strong
                      className={`tabular-nums ${
                        rateResult.installmentChange < 0
                          ? 'text-[var(--color-app-accent)]'
                          : 'text-rose-300'
                      }`}
                    >
                      {rateResult.installmentChange > 0 ? '+' : ''}
                      {formatNumber(rateResult.installmentChange)}
                    </strong>
                  </div>
                )}
              {rateResult &&
                rateResult.refinanceFee > 0 &&
                rateResult.netSaving != null && (
                  <div>
                    <span className="text-app-secondary">
                      {t('simulate.netSaving')}:{' '}
                    </span>
                    <strong
                      className={`tabular-nums ${
                        rateResult.netSaving >= 0
                          ? 'text-[var(--color-app-accent)]'
                          : 'text-rose-300'
                      }`}
                    >
                      {formatNumber(rateResult.netSaving)}
                    </strong>
                    {rateResult.breakEvenMonths != null && (
                      <span className="ml-2 text-xs text-app-muted">
                        ({t('simulate.breakEven')}: {rateResult.breakEvenMonths}{' '}
                        {t('simulate.months')})
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {mode === 'compare' && compareRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs text-app-muted">{t('simulate.compareHint')}</p>
            {compareRows.map((row, index) => (
              <div
                key={row.id}
                className={`rounded-xl border px-3 py-3 ${
                  index === 0
                    ? 'border-[var(--color-app-accent)]/40 bg-[var(--color-app-accent)]/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-semibold text-app-primary">
                      {row.name}
                      {row.isCurrent ? (
                        <span className="ml-2 text-xs font-normal text-app-muted">
                          ({t('simulate.thisLoan')})
                        </span>
                      ) : null}
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-app-muted">
                      {formatNumber(row.rate)}% · {t('simulate.balance')}:{' '}
                      {formatNumber(row.balance)}
                    </p>
                  </div>
                  {index === 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--color-app-accent)]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-app-accent)]">
                      {t('simulate.best')}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-app-muted">
                      {t('simulate.interestSaved')}
                    </span>
                    <p className="m-0 tabular-nums text-app-primary">
                      {formatNumber(row.interestSavedTerm)}
                    </p>
                  </div>
                  <div>
                    <span className="text-app-muted">
                      {t('simulate.monthsSaved')}
                    </span>
                    <p className="m-0 tabular-nums text-app-primary">
                      {row.monthsSaved}
                    </p>
                  </div>
                  <div>
                    <span className="text-app-muted">
                      {t('simulate.installmentDrop')}
                    </span>
                    <p className="m-0 tabular-nums text-app-primary">
                      {formatNumber(row.installmentDrop)}
                    </p>
                  </div>
                  <div>
                    <span className="text-app-muted">
                      {t('simulate.paysOff')}
                    </span>
                    <p className="m-0 text-app-primary">
                      {row.paysOff ? t('common.yes') : t('common.no')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </VaulDrawer>
  );
};

export default LoanSimulateDrawer;
