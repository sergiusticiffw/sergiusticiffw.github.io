import React, { useCallback, useEffect, useState } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useSettingsCurrency } from '@stores/settingsStore';
import { formatNumber } from '@shared/utils/utils';
import type {
  SimulationResult,
  ExtraPaymentSimulatorConfig,
} from '@features/loans/utils/loanSimulation';
import { FiSliders, FiTrendingDown, FiClock, FiCalendar } from 'react-icons/fi';

interface ExtraPaymentSimulatorProps {
  customExtra: number;
  onExtraChange: (value: number) => void;
  scenario: SimulationResult | null;
  simulatorConfig: ExtraPaymentSimulatorConfig;
  disabled?: boolean;
}

const ExtraPaymentSimulator: React.FC<ExtraPaymentSimulatorProps> = ({
  customExtra,
  onExtraChange,
  scenario,
  simulatorConfig,
  disabled = false,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const { presets, maxExtra, step, baseInstallment } = simulatorConfig;
  const [localValue, setLocalValue] = useState(customExtra);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    setLocalValue(customExtra);
  }, [customExtra]);

  const debouncedChange = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (value: number) => {
        setLocalValue(value);
        clearTimeout(timer);
        timer = setTimeout(() => onExtraChange(value), 150);
      };
    })(),
    [onExtraChange]
  );

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedChange(Number(e.target.value));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(maxExtra, Math.max(0, Number(e.target.value) || 0));
    debouncedChange(v);
  };

  const iconTw = 'w-4 h-4 shrink-0 text-[var(--color-app-accent)]';
  const futureRows =
    scenario?.schedule.filter(
      (r) =>
        !('type' in r && (r as { type?: string }).type === 'annual_summary') &&
        r.was_payed !== true
    ) ?? [];

  if (disabled) return null;

  const formatPresetLabel = (amount: number, percentLabel: string | null) => {
    if (amount === 0) return t('loan.simulator.none');
    if (percentLabel) {
      return `${percentLabel} (${formatNumber(amount)} ${currency})`;
    }
    return `+${formatNumber(amount)} ${currency}`;
  };

  return (
    <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <FiSliders className="text-lg text-[var(--color-app-accent)]" />
        <h3 className="text-base font-semibold text-white m-0">
          {t('loan.simulator.title')}
        </h3>
      </div>

      <p className="text-sm text-white/55 mb-1 m-0">{t('loan.simulator.subtitle')}</p>
      {baseInstallment > 0 && (
        <p className="text-xs text-white/40 mb-4 m-0">
          {t('loan.simulator.installmentBase')}: {formatNumber(baseInstallment)}{' '}
          {currency}
        </p>
      )}
      {baseInstallment <= 0 && <div className="mb-4" />}

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((preset) => (
          <button
            key={preset.amount}
            type="button"
            onClick={() => onExtraChange(preset.amount)}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              localValue === preset.amount
                ? 'bg-[var(--color-app-accent)]/20 border-[var(--color-app-accent)]/50 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
            }`}
          >
            {formatPresetLabel(preset.amount, preset.percentLabel)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-5">
        <input
          type="range"
          min={0}
          max={maxExtra || 1}
          step={step}
          value={localValue}
          onChange={handleSlider}
          disabled={maxExtra <= 0}
          className="flex-1 h-2 rounded-full appearance-none bg-white/10 accent-[var(--color-app-accent)] cursor-pointer disabled:opacity-40"
          aria-label={t('loan.simulator.extraMonthly')}
        />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-white/50 text-sm">{currency}</span>
          <input
            type="number"
            min={0}
            max={maxExtra}
            step={step}
            value={localValue}
            onChange={handleInput}
            disabled={maxExtra <= 0}
            className="w-24 py-2 px-2 text-center text-sm font-bold text-white bg-white/10 border border-white/10 rounded-lg tabular-nums focus:outline-none focus:border-[var(--color-app-accent)] disabled:opacity-40"
            aria-label={t('loan.simulator.extraMonthly')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3 transition-all duration-300">
          <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
            <FiCalendar className={iconTw} />
            {t('loan.simulator.newPayoff')}
          </div>
          <div className="text-lg font-bold text-white tabular-nums transition-all duration-300">
            {scenario?.payoffDate ?? '-'}
          </div>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-xl p-3 transition-all duration-300">
          <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
            <FiClock className={iconTw} />
            {t('loan.simulator.monthsSaved')}
          </div>
          <div className="text-lg font-bold text-white tabular-nums transition-all duration-300">
            {scenario?.monthsSaved ?? 0}
          </div>
        </div>
        <div className="bg-[var(--color-app-accent)]/10 border border-[var(--color-app-accent)]/25 rounded-xl p-3 transition-all duration-300">
          <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
            <FiTrendingDown className={iconTw} />
            {t('loan.simulator.interestSaved')}
          </div>
          <div className="text-lg font-bold text-[var(--color-app-accent)] tabular-nums transition-all duration-300">
            {formatNumber(scenario?.interestSaved ?? 0)}
          </div>
        </div>
      </div>

      {localValue > 0 && futureRows.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSchedule((s) => !s)}
            className="text-sm text-[var(--color-app-accent)] font-medium bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            {showSchedule
              ? t('loan.simulator.hideSchedule')
              : t('loan.simulator.showSchedule')}
          </button>
          {showSchedule && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50 text-xs">
                    <th className="py-2 px-3 text-left font-medium">
                      {t('amortization.date')}
                    </th>
                    <th className="py-2 px-3 text-right font-medium">
                      {t('amortization.installment')}
                    </th>
                    <th className="py-2 px-3 text-right font-medium">
                      {t('amortization.principal')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {futureRows.slice(0, 8).map((row, i) => (
                    <tr
                      key={`${row.date}-${i}`}
                      className="border-t border-white/5 text-white/80"
                    >
                      <td className="py-2 px-3">{row.date}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatNumber(Number(row.installment) || 0)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatNumber(Number(row.principal) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExtraPaymentSimulator;
