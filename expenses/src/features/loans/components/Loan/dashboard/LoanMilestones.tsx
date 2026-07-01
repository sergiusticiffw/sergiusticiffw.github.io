import React from 'react';
import { useLocalization } from '@shared/context/localization';
import type { LoanMilestone } from '@features/loans/utils/loanSimulation';
import { FiCheck } from 'react-icons/fi';

interface LoanMilestonesProps {
  milestones: LoanMilestone[];
  progress: number;
}

const milestoneLabels: Record<LoanMilestone['id'], string> = {
  '25': 'loan.milestones.paid25',
  '50': 'loan.milestones.paid50',
  '75': 'loan.milestones.paid75',
  '100': 'loan.milestones.fullyPaid',
};

const LoanMilestones: React.FC<LoanMilestonesProps> = ({
  milestones,
  progress,
}) => {
  const { t } = useLocalization();

  return (
    <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl p-5 shadow-lg">
      <h3 className="text-base font-semibold text-white m-0 mb-5">
        {t('loan.milestones.title')}
      </h3>

      {/* Desktop horizontal timeline */}
      <div className="hidden sm:block relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/10" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] transition-[width] duration-500"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
        <div className="relative flex justify-between">
          {milestones.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-2 w-1/4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  m.completed
                    ? 'bg-[var(--color-app-accent)] border-[var(--color-app-accent)] text-white'
                    : 'bg-[#1a1a2e] border-white/20 text-white/40'
                }`}
              >
                {m.completed ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{m.percent}%</span>
                )}
              </div>
              <span
                className={`text-xs font-semibold text-center ${
                  m.completed ? 'text-white' : 'text-white/45'
                }`}
              >
                {t(milestoneLabels[m.id])}
              </span>
              <span className="text-[0.65rem] text-white/40 tabular-nums">
                {m.date ?? t('loan.milestones.estimated')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile vertical timeline */}
      <div className="flex flex-col gap-0 sm:hidden">
        {milestones.map((m, i) => (
          <div key={m.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 ${
                  m.completed
                    ? 'bg-[var(--color-app-accent)] border-[var(--color-app-accent)] text-white'
                    : 'bg-[#1a1a2e] border-white/20 text-white/40'
                }`}
              >
                {m.completed ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{m.percent}%</span>
                )}
              </div>
              {i < milestones.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-8 my-1 ${
                    m.completed ? 'bg-[var(--color-app-accent)]/50' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
            <div className="pb-5">
              <div
                className={`text-sm font-semibold ${
                  m.completed ? 'text-white' : 'text-white/50'
                }`}
              >
                {t(milestoneLabels[m.id])}
              </div>
              <div className="text-xs text-white/40 tabular-nums">
                {m.date ?? t('loan.milestones.estimated')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoanMilestones;
