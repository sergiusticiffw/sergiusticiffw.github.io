import React from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';

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
    <div className="w-full flex flex-col gap-3">
      {/* Search Input */}
      <div className="flex items-center bg-white/[0.05] rounded-xl px-4 gap-2 w-full transition-colors duration-200 focus-within:bg-white/[0.08]">
        <FiSearch className="text-white/40 text-lg shrink-0" />

        {/* Show selected category as chip inside search - clickable to change */}
        {categoryValue && !isSearchFocused && (
          <div
            className="bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] text-white text-xs font-medium py-1.5 px-3 rounded-2xl whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 hover:from-[#6b9dff] hover:to-[#5a8dec] hover:scale-105"
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
            setTimeout(() => setIsSearchFocused(false), 200);
          }}
          placeholder={
            categoryValue && !isSearchFocused
              ? t('filters.searchInCategory')
              : defaultPlaceholder
          }
          className="flex-1 bg-transparent border-none py-4 text-white text-[0.95rem] outline-none min-w-0 placeholder:text-white/40"
        />

        {hasFilters && (
          <button
            onClick={handleClear}
            className="bg-transparent border-none p-2 flex items-center justify-center shrink-0 cursor-pointer [&_svg]:text-white/40 [&_svg]:transition-colors hover:[&_svg]:text-white/70"
            title={t('filters.clearAll')}
          >
            <FiX />
          </button>
        )}
      </div>

      {/* Category Chips - Show when focused */}
      {isSearchFocused && (
        <div className="flex flex-wrap gap-2 animate-[slideDown_0.2s_ease-out]">
          {categoryChips.map((category) => (
            <button
              key={category.value}
              onClick={() => handleCategoryClick(category.value)}
              className={`rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all duration-200 whitespace-nowrap border ${
                category.value === categoryValue
                  ? 'bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] border-transparent text-white font-medium shadow-[0_2px_8px_rgba(91,141,239,0.3)]'
                  : 'bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white/90'
              }`}
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
