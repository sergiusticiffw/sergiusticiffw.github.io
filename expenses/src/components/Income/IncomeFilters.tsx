import React from 'react';
import { useLocalization } from '@context/localization';
import { FaFilter, FaSearch, FaTimes } from 'react-icons/fa';
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
    onTextFilterChange(event.target.value);
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onMonthFilterChange(event.target.value);
  };

  const hasActiveFilters = textFilter || selectedMonth;

  return (
    <div className="income-filters">
      {/* Text Search - Same as SearchBar */}
      <div className="search-bar-container">
        <FaSearch className="search-icon" />
        <input
          type="text"
          value={textFilter}
          onChange={handleTextFilterChange}
          placeholder={t('filters.search')}
          className="search-input"
        />
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="clear-btn">
            <FaTimes />
          </button>
        )}
      </div>

      {/* Month Filter */}
      <div className="search-bar-container">
        <FaFilter className="search-icon" />
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="search-input month-input"
          placeholder={t('filters.selectMonth')}
        />
      </div>
    </div>
  );
};

export default IncomeFilters;