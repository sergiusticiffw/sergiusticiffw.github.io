import React, { ReactNode, memo } from 'react';

interface NoDataProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const NoData: React.FC<NoDataProps> = memo(
  ({ icon, title, description, action }) => {
    return (
      <div className="text-center py-12 px-8 bg-transparent border-none">
        <div className="flex justify-center mb-4 [&_svg]:w-12 [&_svg]:h-12 [&_svg]:text-[rgba(91,141,239,0.6)]">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-white/90 m-0 mb-2">{title}</h3>
        <p className="text-[0.95rem] text-white/60 m-0 mb-6 leading-normal">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center justify-center gap-2 py-3 px-6 bg-[rgba(91,141,239,0.1)] border border-[rgba(91,141,239,0.3)] rounded-lg text-[#5b8def] text-[0.95rem] font-semibold cursor-pointer transition-all duration-300 hover:bg-[rgba(91,141,239,0.2)] hover:border-[#5b8def] hover:-translate-y-0.5"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }
);

NoData.displayName = 'NoData';

export default NoData;
