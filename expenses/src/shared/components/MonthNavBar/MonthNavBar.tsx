import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';

interface MonthNavBarProps {
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  /** Extra classes, e.g. responsive visibility (`hidden md:flex`). */
  className?: string;
}

const BUTTON_CLASS =
  'flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-app-subtle bg-app-surface-hover text-app-secondary text-[1.3rem] transition-colors duration-200 hover:border-[var(--color-app-accent)]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-app-accent)] disabled:cursor-not-allowed disabled:opacity-30 [&_svg]:pointer-events-none';

/**
 * Floating previous/next month control shared by Home and Income.
 * Sits just above the bottom navigation, including the device safe area.
 */
const MonthNavBar = ({
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  className = 'flex',
}: MonthNavBarProps) => {
  const { t } = useLocalization();

  return (
    <div
      className={`fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-1/2 z-[1050] -translate-x-1/2 items-center justify-center gap-4 rounded-[20px] bg-[var(--color-app-bg)] px-4 py-2 shadow-lg backdrop-blur-md ${className}`}
    >
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label={t('ux.previousMonth')}
      >
        <FiChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={t('ux.nextMonth')}
      >
        <FiChevronRight aria-hidden="true" />
      </button>
    </div>
  );
};

export default MonthNavBar;
