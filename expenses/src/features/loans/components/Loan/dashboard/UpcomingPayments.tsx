import React from 'react';
import { useLocalization } from '@shared/context/localization';
import { formatNumber } from '@shared/utils/utils';
import type { UpcomingPayment } from '@features/loans/utils/loanSimulation';
import { FiCalendar, FiPlus, FiAlertCircle } from 'react-icons/fi';

interface UpcomingPaymentsProps {
  payments: UpcomingPayment[];
  onAddPayment: () => void;
}

const UpcomingPayments: React.FC<UpcomingPaymentsProps> = ({
  payments,
  onAddPayment,
}) => {
  const { t } = useLocalization();
  const iconTw = 'w-4 h-4 shrink-0 text-[var(--color-app-accent)]';

  if (!payments.length) return null;

  const next = payments[0];
  const isUrgent = next.daysUntil >= 0 && next.daysUntil <= 7;
  const isOverdue = next.isOverdue;

  return (
    <div
      className={`rounded-2xl p-5 mb-2 border ${
        isOverdue
          ? 'bg-red-500/10 border-red-500/30'
          : isUrgent
            ? 'bg-gradient-to-br from-[var(--color-app-accent)]/20 to-white/[0.04] border-[var(--color-app-accent)]/35 shadow-[0_0_20px_var(--color-app-accent-shadow)]'
            : 'bg-gradient-to-br from-[var(--color-app-accent)]/15 to-white/[0.04] border-[var(--color-app-accent)]/25'
      }`}
    >
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 m-0">
        {t('loan.upcoming.title')}
      </h3>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-white">
            {t('loan.nextPaymentRegular')}
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-white/70">
            <FiCalendar className={iconTw} />
            {next.date}
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-2xl font-extrabold text-white tabular-nums">
            {formatNumber(next.installment)}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold rounded-full ${
              isOverdue
                ? 'bg-red-500/20 text-red-300'
                : isUrgent
                  ? 'bg-[var(--color-app-accent)]/25 text-[var(--color-app-accent)]'
                  : 'bg-white/10 text-white/60'
            }`}
          >
            {isOverdue ? (
              <>
                <FiAlertCircle className="w-3 h-3" />
                {t('loan.upcoming.overdue')}
              </>
            ) : (
              t('loan.upcoming.daysLeft').replace(
                '{days}',
                String(next.daysUntil)
              )
            )}
          </span>
        </div>
      </div>

      {payments.length > 1 && (
        <div className="border-t border-white/10 pt-3 mb-4">
          <p className="text-xs text-white/45 uppercase tracking-wider mb-2 m-0">
            {t('loan.upcoming.scheduled')}
          </p>
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {payments.slice(1).map((p) => (
              <li
                key={p.date}
                className="flex items-center justify-between text-sm text-white/70"
              >
                <span className="inline-flex items-center gap-2">
                  <FiCalendar className="w-3.5 h-3.5 text-white/40" />
                  {p.date}
                </span>
                <span className="font-semibold text-white tabular-nums">
                  {formatNumber(p.installment)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onAddPayment}
        className="inline-flex items-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-[var(--color-app-accent)] rounded-xl hover:bg-[var(--color-app-accent-hover)] active:scale-[0.98] transition-all cursor-pointer"
      >
        <FiPlus className="w-4 h-4" />
        <span>{t('loan.addPayment')}</span>
      </button>
    </div>
  );
};

export default UpcomingPayments;
