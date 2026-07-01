import React, { ReactNode } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  defaultOpenOnDesktop?: boolean;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  open,
  onToggle,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2.5 py-4 px-5 text-left bg-transparent border-none cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
          {icon}
          <h3 className="text-base font-semibold text-white m-0 tracking-tight">
            {title}
          </h3>
        </div>
        {open ? (
          <FiChevronUp className="text-white/50 shrink-0" aria-hidden />
        ) : (
          <FiChevronDown className="text-white/50 shrink-0" aria-hidden />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-white/[0.06]">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
