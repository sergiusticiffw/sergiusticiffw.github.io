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
 * First tap on the search input → open filter panel only (no keyboard).
 * Second tap → allow typing / show keyboard.
 * Scrolls that start on the input do not open the panel.
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
      const isTouch =
        lastPointerType.current === 'touch' ||
        lastPointerType.current === 'pen';

      if (isTouch) {
        // Never unlock the keyboard from focus alone — only from a second tap.
        if (!searchEditable) {
          e.currentTarget.blur();
        }
        return;
      }

      // Mouse / keyboard: open and allow typing immediately.
      openPanel(true);
    },
    [searchEditable, openPanel]
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

      const input = e.currentTarget;

      // Second tap: unlock typing and show keyboard.
      if (isFilterFocused) {
        // Prevent focusing while still readOnly this frame; focus after unlock.
        e.preventDefault();
        setSearchEditable(true);
        requestAnimationFrame(() => {
          input.focus();
        });
        return;
      }

      // First tap: prevent focus so the soft keyboard cannot open.
      e.preventDefault();

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
