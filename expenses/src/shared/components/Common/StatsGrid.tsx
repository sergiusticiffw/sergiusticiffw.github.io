import React, { ReactNode } from 'react';

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  filtered?: boolean;
  className?: string;
}

const columnClasses: Record<2 | 3 | 4 | 5, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

const StatsGrid: React.FC<StatsGridProps> = ({
  children,
  columns = 3,
  filtered = false,
  className = '',
}) => {
  return (
    <div
      className={`grid gap-4 mb-6 transition-all duration-300 ${filtered ? 'grid-cols-1 max-w-[300px] mx-auto' : columnClasses[columns]} sm:gap-3 ${className}`}
    >
      {children}
    </div>
  );
};

export default StatsGrid;
