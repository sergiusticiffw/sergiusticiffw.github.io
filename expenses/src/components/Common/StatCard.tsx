import React, { ReactNode, memo } from 'react';
import './StatCard.scss';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = memo(({
  icon,
  value,
  label,
  className = '',
}) => {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;
