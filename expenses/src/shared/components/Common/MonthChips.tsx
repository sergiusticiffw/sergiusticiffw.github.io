import React from 'react';
import { FiCalendar } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';

interface MonthOption {
  value: string;
  label: string;
}

interface MonthChipsProps {
  months: MonthOption[];
  selectedMonth: string;
  onMonthClick: (month: string) => void;
  showTitle?: boolean;
  className?: string;
}

const MonthChips: React.FC<MonthChipsProps> = ({
  months,
  selectedMonth,
  onMonthClick,
  showTitle = true,
  className = '',
}) => {
  const { t } = useLocalization();

  // Filter out invalid months (those without valid labels)
  const validMonths = months.filter(
    (month) => month.label && month.label !== month.value && month.label !== ''
  );

  if (validMonths.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 mt-3 overflow-x-hidden w-full max-w-full ${className}`}>
      {showTitle && (
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-app-muted [&_svg]:size-3.5 [&_svg]:text-[var(--color-app-accent)]">
          <FiCalendar />
          {t('filters.months')}
        </div>
      )}
      <div className="flex flex-wrap gap-2 overflow-x-hidden w-full max-w-full">
        {validMonths.map((month) => (
          <button
            key={month.value}
            onClick={() => onMonthClick(month.value)}
            className={`rounded-xl py-2.5 px-4 text-sm cursor-pointer transition-all duration-200 whitespace-nowrap border ${
              month.value === selectedMonth
                ? 'border-0 bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] font-medium shadow-[0_2px_8px_var(--color-app-accent-shadow)] hover:opacity-95'
                : 'border-white/[0.12] bg-white/[0.06] text-app-secondary hover:bg-white/[0.1] hover:text-app-primary hover:border-white/[0.18]'
            }`}
            aria-label={`Select ${month.label}`}
          >
            {month.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MonthChips;
