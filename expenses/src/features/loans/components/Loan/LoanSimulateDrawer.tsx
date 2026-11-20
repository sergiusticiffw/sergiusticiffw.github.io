import { useMemo, useState } from 'react';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useLocalization } from '@shared/context/localization';
import { formatNumber, getLocale } from '@shared/utils/utils';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import {
  getLoanSimulator,
  nextRegular,
} from '../../../../ai/loanScenarios';
import type { ExtraStrategy } from '../../../../ai/loanScenarios';

type LoanSimulateDrawerProps = {
  show: boolean;
  onClose: () => void;
  loan: ApiLoan;
  payments: ApiPaymentItem[];
};

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

/**
 * What-if for one extra payment on an existing loan. Uses the same
 * LoanSimulator as the AI assistant; nothing is written anywhere.
 */
const LoanSimulateDrawer = ({
  show,
  onClose,
  loan,
  payments,
}: LoanSimulateDrawerProps) => {
  const { t, language } = useLocalization();
  const locale = getLocale(language);

  const simulator = useMemo(
    () => getLoanSimulator({ loan, items: payments }),
    [loan, payments]
  );

  const [amountInput, setAmountInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [strategy, setStrategy] = useState<ExtraStrategy>('reduce_term');

  if (!simulator) {
    return (
      <VaulDrawer show={show} onClose={onClose} title={t('simulate.title')}>
        <p className="m-0 text-sm text-app-muted">{t('simulate.unavailable')}</p>
      </VaulDrawer>
    );
  }

  const date = dateInput || simulator.defaultDate();
  const amount = parseFloat(amountInput.replace(',', '.'));
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const dateInTerm = date >= simulator.startIso && date <= simulator.endIso;
  const canSimulate = hasAmount && dateInTerm;

  const baseline = simulator.baseline(true);
  const scenario = canSimulate
    ? simulator.runExtra({ date, amount }, strategy)
    : null;

  const baseNext = nextRegular(baseline)?.installment ?? null;
  const scenarioNext = scenario ? nextRegular(scenario)?.installment ?? null : null;
  const interestSaved = scenario
    ? Math.max(0, baseline.totalInterest - scenario.totalInterest)
    : 0;

  const strategyOptions: { value: ExtraStrategy; label: string; desc: string }[] = [
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

  return (
    <VaulDrawer show={show} onClose={onClose} title={t('simulate.title')}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-app-muted">{t('simulate.hint')}</p>

        <div className="form-group">
          <label htmlFor="simulate-amount">{t('simulate.amount')}</label>
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

        <div className="form-group">
          <label htmlFor="simulate-date">{t('simulate.date')}</label>
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

        <div role="group" aria-label={t('simulate.strategy')} className="grid grid-cols-2 gap-2">
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

        {!canSimulate && (
          <p className="m-0 text-sm text-app-muted" role={amountInput && !dateInTerm ? 'alert' : undefined}>
            {amountInput && !dateInTerm
              ? t('simulate.outsideTerm')
              : t('simulate.enterAmount')}
          </p>
        )}

        {scenario && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3 text-sm">
              <span />
              <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('simulate.current')}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('simulate.withExtra')}
              </span>

              <span className="text-app-secondary">{t('simulate.totalInterest')}</span>
              <span className="text-right tabular-nums text-app-primary">
                {formatNumber(baseline.totalInterest)}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatNumber(scenario.totalInterest)}
              </span>

              <span className="text-app-secondary">{t('simulate.payoffDate')}</span>
              <span className="text-right tabular-nums text-app-primary">
                {formatIsoDate(baseline.payoffDate, locale)}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {formatIsoDate(scenario.payoffDate, locale)}
              </span>

              <span className="text-app-secondary">{t('simulate.nextInstallment')}</span>
              <span className="text-right tabular-nums text-app-primary">
                {baseNext != null ? formatNumber(baseNext) : '-'}
              </span>
              <span className="text-right tabular-nums text-app-primary">
                {scenarioNext != null ? formatNumber(scenarioNext) : '-'}
              </span>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3 text-sm">
              <span className="text-app-secondary">{t('simulate.interestSaved')}: </span>
              <strong className="tabular-nums text-[var(--color-app-accent)]">
                {formatNumber(interestSaved)}
              </strong>
            </div>
          </div>
        )}
      </div>
    </VaulDrawer>
  );
};

export default LoanSimulateDrawer;
