import React from 'react';
import { FiCalendar } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import './MonthChips.scss';

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
    <div className={`${className}`}>
      {showTitle && (
        <div className="chips-section-title">
          <FiCalendar />
          {t('filters.months')}
        </div>
      )}
      <div className="month-chips-list">
        {validMonths.map((month) => (
          <button
            key={month.value}
            onClick={() => onMonthClick(month.value)}
            className={`month-chip ${month.value === selectedMonth ? 'active' : ''}`}
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
