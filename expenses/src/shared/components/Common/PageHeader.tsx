import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`text-center mb-6 pt-6 ${className}`}>
      <h1 className="text-3xl font-bold m-0 mb-2 text-white">{title}</h1>
      {subtitle && <p className="text-[0.95rem] text-white/50 m-0">{subtitle}</p>}
    </div>
  );
};

export default PageHeader;
