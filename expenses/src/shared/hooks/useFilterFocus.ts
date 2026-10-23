import {
  useState,
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type FocusEvent as ReactFocusEvent,
} from 'react';

const TAP_MOVE_PX = 12;
const TAP_MAX_MS = 400;

/**
 * Opens the filter panel only when the user taps/clicks the search input itself.
 * Scrolls that start on the input do not open it. Padding, icons, and chrome
 * around the field are ignored — attach handlers only to the <input>.
 */
export const useFilterFocus = () => {
  const [isFilterFocused, setIsFilterFocused] = useState(false);
  const [searchEditable, setSearchEditable] = useState(false);
  const lastPointerType = useRef<string>('mouse');
  const gestureRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
    startedAt: number;
    moved: boolean;
  } | null>(null);

  const openPanel = useCallback((editable: boolean) => {
    setIsFilterFocused(true);
    setSearchEditable(editable);
  }, []);

  const closePanel = useCallback(() => {
    setIsFilterFocused(false);
    setSearchEditable(false);
  }, []);

  const handleFocus = useCallback(
    (e: ReactFocusEvent<HTMLInputElement>) => {
      // Touch: focus alone must not open the panel (scroll / accidental focus).
      if (
        lastPointerType.current === 'touch' ||
        lastPointerType.current === 'pen'
      ) {
        if (!isFilterFocused) {
          e.currentTarget.blur();
          return;
        }
        setSearchEditable(true);
        return;
      }
      openPanel(true);
    },
    [isFilterFocused, openPanel]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => closePanel(), 200);
  }, [closePanel]);

  const handleChipClick = useCallback(() => {
    openPanel(false);
  }, [openPanel]);

  const handleSelection = useCallback(() => {
    closePanel();
  }, [closePanel]);

  /** Attach only to the search <input>, never the surrounding bar. */
  const handleSearchPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLInputElement>) => {
      lastPointerType.current = e.pointerType || 'mouse';
      if (e.pointerType === 'mouse') return;

      if (isFilterFocused) {
        setSearchEditable(true);
        return;
      }

      // Do not preventDefault — that would block scrolling from the field.
      const gesture = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        startedAt: Date.now(),
        moved: false,
      };
      gestureRef.current = gesture;

      const markMoved = () => {
        if (gestureRef.current) gestureRef.current.moved = true;
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
        window.removeEventListener('scroll', markMoved, true);
        gestureRef.current = null;

        if (!g || ev.pointerId !== g.pointerId || g.moved) return;
        if (Date.now() - g.startedAt > TAP_MAX_MS) return;

        openPanel(false);
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.blur === 'function') active.blur();
      };

      window.addEventListener('scroll', markMoved, true);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    },
    [isFilterFocused, openPanel]
  );

  return {
    isFilterFocused,
    searchEditable,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
    handleSearchPointerDown,
  };
};
