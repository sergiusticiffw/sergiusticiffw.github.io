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
        <div className="flex items-center gap-2 text-xs font-semibold text-white/50 uppercase tracking-wider [&_svg]:text-sm">
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
                ? 'bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] border-transparent text-white font-medium shadow-[0_2px_8px_rgba(91,141,239,0.3)]'
                : 'bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white/90'
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
