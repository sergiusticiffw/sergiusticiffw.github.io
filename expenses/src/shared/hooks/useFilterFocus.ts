import { useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Hook for managing filter panel open state.
 * On touch, the first tap opens the panel without focusing the search input
 * (avoids the mobile keyboard). A second tap on search can focus and type.
 */
export const useFilterFocus = () => {
  const [isFilterFocused, setIsFilterFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow chip click
    setTimeout(() => setIsFilterFocused(false), 200);
  }, []);

  const handleChipClick = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleSelection = useCallback(() => {
    setIsFilterFocused(false);
  }, []);

  const handleSearchPointerDownCapture = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;
      if (isFilterFocused) return;
      e.preventDefault();
      setIsFilterFocused(true);
    },
    [isFilterFocused]
  );

  return {
    isFilterFocused,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
    handleSearchPointerDownCapture,
  };
};
