import React from 'react';
import { useLocalization } from '@shared/context/localization';
import { formatNumber } from '@shared/utils/utils';
import type { UpcomingPayment } from '@features/loans/utils/loanSimulation';
import { FiCalendar, FiPlus } from 'react-icons/fi';

interface UpcomingPaymentsProps {
  payment: UpcomingPayment | null;
  onAddPayment: () => void;
}

const UpcomingPayments: React.FC<UpcomingPaymentsProps> = ({
  payment,
  onAddPayment,
}) => {
  const { t } = useLocalization();

  if (!payment) return null;

  const statusLabel = payment.isOverdue
    ? t('loan.upcoming.overdue')
    : t('loan.upcoming.daysLeft').replace('{days}', String(payment.daysUntil));

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-white m-0">
          {t('loan.upcoming.title')}
        </h3>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            payment.isOverdue
              ? 'bg-red-500/15 text-red-300'
              : payment.daysUntil <= 7
                ? 'bg-[var(--color-app-accent)]/20 text-[var(--color-app-accent)]'
                : 'bg-white/8 text-white/50'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mb-5">
        <div className="text-3xl font-bold text-white tabular-nums tracking-tight">
          {formatNumber(payment.installment)}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/45">
          <FiCalendar className="w-3.5 h-3.5 shrink-0" />
          <span className="tabular-nums">{payment.date}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddPayment}
        className="inline-flex w-full items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-[var(--color-app-accent)] rounded-xl hover:bg-[var(--color-app-accent-hover)] active:scale-[0.98] transition-all cursor-pointer"
      >
        <FiPlus className="w-4 h-4" />
        <span>{t('loan.addPayment')}</span>
      </button>
    </div>
  );
};

export default UpcomingPayments;
