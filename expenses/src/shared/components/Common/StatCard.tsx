import React, { ReactNode, memo } from 'react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = memo(
  ({ icon, value, label, className = '' }) => {
    return (
      <div className={`bg-white/[0.05] rounded-2xl py-4 px-3 flex flex-col items-center justify-center gap-2.5 min-h-[100px] transition-colors duration-200 hover:bg-white/[0.08] sm:min-h-[90px] sm:py-3.5 sm:px-2.5 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-[rgba(91,141,239,0.15)] flex items-center justify-center [&_svg]:text-2xl [&_svg]:text-[#5b8def] sm:w-10 sm:h-10 sm:[&_svg]:text-xl">
          {icon}
        </div>
        <div className="text-2xl font-bold text-white leading-none sm:text-xl">{value}</div>
        <div className="text-sm text-white/60 text-center sm:text-xs">{label}</div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export default StatCard;
