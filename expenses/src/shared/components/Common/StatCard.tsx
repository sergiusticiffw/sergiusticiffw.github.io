import React, { ReactNode, memo } from 'react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  /** Accent style (e.g. for "Paid" or highlighted metric) */
  accent?: boolean;
  className?: string;
}

const baseCard =
  'rounded-xl py-5 px-4 min-h-[120px] flex flex-col items-center justify-center gap-2 text-center shadow-sm ' +
  'bg-gradient-to-b from-white/[0.08] to-white/[0.04] border border-white/10 ' +
  'hover:from-white/[0.1] hover:to-white/[0.06] hover:border-white/15 hover:shadow-md hover:-translate-y-0.5 transition-all ' +
  'sm:min-h-[105px] sm:py-4 sm:px-3';

const accentCard =
  'border border-[var(--color-app-accent)]/35 bg-gradient-to-b from-[var(--color-app-accent)]/12 to-[var(--color-app-accent)]/6 shadow-md ' +
  'hover:from-[var(--color-app-accent)]/16 hover:to-[var(--color-app-accent)]/8 hover:border-[var(--color-app-accent)]/45 hover:shadow-lg';

const iconBase =
  'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)] sm:w-9 sm:h-9 [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-4 sm:[&_svg]:h-4';

const StatCard: React.FC<StatCardProps> = memo(
  ({ icon, value, label, accent = false, className = '' }) => {
    return (
      <div
        className={`${baseCard} ${accent ? accentCard : ''} ${className}`}
      >
        <div className={iconBase}>{icon}</div>
        <div className="text-xl font-bold text-white tabular-nums tracking-tight sm:text-lg">
          {value}
        </div>
        <div className="text-[0.7rem] font-semibold text-white/50 uppercase tracking-wide">
          {label}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export default StatCard;
