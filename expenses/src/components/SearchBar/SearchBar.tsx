import React from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useLocalization } from '@context/localization';
import './SearchBar.scss';

interface SearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  categoryValue: string;
  onCategoryChange: (value: string) => void;
  categories: Array<{ value: string; label: string }>;
  placeholder?: string;
  onClear?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchValue,
  onSearchChange,
  categoryValue,
  onCategoryChange,
  categories,
  placeholder,
  onClear,
}) => {
  const { t } = useLocalization();
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  
  // Use provided placeholder or default translated placeholder
  const defaultPlaceholder = placeholder || t('filters.search');

  const handleClear = () => {
    onSearchChange('');
    onCategoryChange('');
    // Call the optional onClear callback to reset month index
    if (onClear) {
      onClear();
    }
  };

  const handleCategoryClick = (value: string) => {
    if (value === categoryValue) {
      // Deselect
      onCategoryChange('');
    } else {
      // Select
      onCategoryChange(value);
      setIsSearchFocused(false); // Hide chips after selection
    }
  };

  const hasFilters = searchValue !== '' || categoryValue !== '';

  // Filter out "All categories" option
  const categoryChips = categories.filter((cat) => cat.value !== '');

  // Get selected category label
  const selectedCategoryLabel = categoryValue
    ? categories.find((cat) => cat.value === categoryValue)?.label
    : '';

  // Build display text
  const displayText = selectedCategoryLabel
    ? searchValue
      ? `${selectedCategoryLabel}: ${searchValue}`
      : selectedCategoryLabel
    : searchValue;

  return (
    <div className="search-bar-with-chips">
      {/* Search Input */}
      <div className="search-bar-component">
        <FaSearch className="search-bar-icon" />

        {/* Show selected category as chip inside search - clickable to change */}
        {categoryValue && !isSearchFocused && (
          <div
            className="selected-category-chip clickable"
            onClick={() => setIsSearchFocused(true)}
          >
            {selectedCategoryLabel}
          </div>
        )}

        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => {
            // Delay to allow chip click
            setTimeout(() => setIsSearchFocused(false), 200);
          }}
          placeholder={
            categoryValue && !isSearchFocused
              ? t('filters.searchInCategory')
              : defaultPlaceholder
          }
          className="search-bar-input"
        />

        {hasFilters && (
          <button
            onClick={handleClear}
            className="clear-filters-btn"
            title={t('filters.clearAll')}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Category Chips - Show when focused (to select or change category) */}
      {isSearchFocused && (
        <div className="category-chips">
          {categoryChips.map((category) => (
            <button
              key={category.value}
              onClick={() => handleCategoryClick(category.value)}
              className={`category-chip ${category.value === categoryValue ? 'active' : ''}`}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
