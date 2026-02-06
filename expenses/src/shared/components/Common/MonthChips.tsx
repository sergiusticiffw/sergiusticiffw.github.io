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
        <div className="flex items-center gap-2 text-xs font-semibold text-app-muted uppercase tracking-wider [&_svg]:text-sm">
          <FiCalendar />
          {t('filters.months')}
        </div>
      )}
      <div className="flex flex-wrap gap-2 overflow-x-hidden w-full max-w-full">
        {validMonths.map((month) => (
          <button
            key={month.value}
            onClick={() => onMonthClick(month.value)}
            className={`rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all duration-200 whitespace-nowrap border ${
              month.value === selectedMonth
                ? 'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] border-transparent text-[var(--color-btn-on-accent)] font-medium shadow-[0_2px_8px_var(--color-app-accent-shadow)]'
                : 'bg-app-surface border-app-subtle text-app-secondary hover:bg-app-surface-hover hover:border-[var(--color-border-medium)] hover:text-app-primary'
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
