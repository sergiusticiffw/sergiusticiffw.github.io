import {
  useState,
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

const TAP_MOVE_PX = 10;

/**
 * Hook for managing filter panel open state.
 * On touch, a tap opens the panel without focusing the search input
 * (avoids the mobile keyboard). A second tap on search can focus and type.
 * Scrolls that start on the search bar do not open the panel.
 */
export const useFilterFocus = () => {
  const [isFilterFocused, setIsFilterFocused] = useState(false);
  const [searchEditable, setSearchEditable] = useState(false);
  const lastPointerType = useRef<string>('mouse');
  const gestureRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const handleFocus = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsFilterFocused(false);
      setSearchEditable(false);
    }, 200);
  }, []);

  const handleChipClick = useCallback(() => {
    setIsFilterFocused(true);
  }, []);

  const handleSelection = useCallback(() => {
    setIsFilterFocused(false);
    setSearchEditable(false);
  }, []);

  const clearGesture = useCallback(() => {
    gestureRef.current = null;
  }, []);

  const handleSearchPointerDownCapture = useCallback(
    (e: ReactPointerEvent) => {
      lastPointerType.current = e.pointerType || 'mouse';
      if (e.pointerType === 'mouse') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;

      // Panel already open: second tap may focus/type — don't intercept.
      if (isFilterFocused) {
        setSearchEditable(true);
        return;
      }

      // Defer open until pointerup so scrolls don't open the panel.
      // Do not preventDefault here — that would block scrolling from the search bar.
      gestureRef.current = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        moved: false,
      };

      const onMove = (ev: PointerEvent) => {
        const g = gestureRef.current;
        if (!g || ev.pointerId !== g.pointerId) return;
        if (
          Math.abs(ev.clientX - g.x) > TAP_MOVE_PX ||
          Math.abs(ev.clientY - g.y) > TAP_MOVE_PX
        ) {
          g.moved = true;
        }
      };

      const onEnd = (ev: PointerEvent) => {
        const g = gestureRef.current;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        clearGesture();
        if (!g || ev.pointerId !== g.pointerId || g.moved) return;
        // Confirmed tap: open panel, blur to avoid keyboard.
        setIsFilterFocused(true);
        setSearchEditable(false);
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.blur === 'function') active.blur();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    },
    [isFilterFocused, clearGesture]
  );

  /** Opens the panel; mouse can type immediately, touch stays read-only until second tap. */
  const handleSearchClick = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) return;
    setIsFilterFocused(true);
    if (lastPointerType.current === 'mouse') {
      setSearchEditable(true);
    }
  }, []);

  return {
    isFilterFocused,
    searchEditable,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
    handleSearchPointerDownCapture,
    handleSearchClick,
  };
};
