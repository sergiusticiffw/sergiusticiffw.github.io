import React, { ReactNode } from 'react';
import './StatsGrid.scss';

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
  className = '' 
}) => {
  return (
    <div 
      className={`stats-grid stats-grid-${columns}col ${filtered ? 'filtered' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export default StatsGrid;


