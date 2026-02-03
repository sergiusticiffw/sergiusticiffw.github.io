import React, { ReactNode } from 'react';

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3;
  filtered?: boolean;
  className?: string;
}

const StatsGrid: React.FC<StatsGridProps> = ({
  children,
  columns = 3,
  filtered = false,
  className = '',
}) => {
  return (
    <div
      className={`grid gap-2 mb-6 transition-all duration-300 ${filtered ? 'grid-cols-1 max-w-[300px] mx-auto' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3'} sm:gap-1.5 ${className}`}
    >
      {children}
    </div>
  );
};

export default StatsGrid;
