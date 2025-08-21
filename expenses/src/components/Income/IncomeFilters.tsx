import React from 'react';
import { useLocalization } from '@context/localization';
import { FaFilter, FaSearch } from 'react-icons/fa';
import './IncomeFilters.scss';

interface IncomeFiltersProps {
  textFilter: string;
  selectedMonth: string;
  onTextFilterChange: (value: string) => void;
  onMonthFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const IncomeFilters: React.FC<IncomeFiltersProps> = ({
  textFilter,
  selectedMonth,
  onTextFilterChange,
  onMonthFilterChange,
  onClearFilters,
}) => {
  const { t } = useLocalization();

  const handleTextFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const textFilter = event.target.value;
    onTextFilterChange(textFilter);
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedMonth = event.target.value;
    onMonthFilterChange(selectedMonth);
  };

  const handleClearFilters = () => {
    onClearFilters();
  };

  const hasActiveFilters = textFilter || selectedMonth;

  return (
    <div className="income-filters">
      <div className="filter-group">
        <div className="filter-input">
          <FaSearch className="filter-icon" />
          <input
            type="text"
            value={textFilter}
            onChange={handleTextFilterChange}
                         placeholder={t('filters.search')}
            className="text-filter"
          />
        </div>
        <div className="filter-input">
          <FaFilter className="filter-icon" />
          <input
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="month-filter"
                         placeholder={t('filters.selectMonth')}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button onClick={handleClearFilters} className="clear-filters-btn">
          <FaFilter />
                     {t('filters.clear')}
        </button>
      )}
    </div>
  );
};

export default IncomeFilters;
