import React, { useEffect, useState } from 'react';
import { FaSearch, FaTimesCircle, FaCalendar } from 'react-icons/fa';
import './IncomeFilters.scss';

interface IncomeFiltersProps {
  onFilterChange: (filters: {
    textFilter: string;
    selectedMonth: string;
  }) => void;
}

const IncomeFilters: React.FC<IncomeFiltersProps> = ({ onFilterChange }) => {
  const [filters, setFilters] = useState({
    textFilter: '',
    selectedMonth: '',
  });

  const handleTextFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const textFilter = event.target.value;
    setFilters(prev => ({ ...prev, textFilter }));
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedMonth = event.target.value;
    setFilters(prev => ({ ...prev, selectedMonth }));
  };

  const handleClearFilters = () => {
    setFilters({
      textFilter: '',
      selectedMonth: '',
    });
  };

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const hasActiveFilters = filters.textFilter || filters.selectedMonth;

  return (
    <div className="income-filters">
      <div className="filter-group">
        <div className="filter-input">
          <FaSearch className="filter-icon" />
          <input
            type="text"
            value={filters.textFilter}
            onChange={handleTextFilterChange}
            placeholder="Filter by description..."
            className="text-filter"
          />
        </div>
        <div className="filter-input">
          <FaCalendar className="filter-icon" />
          <input
            type="month"
            value={filters.selectedMonth}
            onChange={handleMonthChange}
            className="month-filter"
            placeholder="Select month"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button onClick={handleClearFilters} className="clear-filters-btn">
          <FaTimesCircle />
          Clear Filters
        </button>
      )}
    </div>
  );
};

export default IncomeFilters;
