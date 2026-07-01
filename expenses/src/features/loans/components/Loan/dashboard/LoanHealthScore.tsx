import React from 'react';
import { useLocalization } from '@shared/context/localization';
import type { LoanHealthScoreResult } from '@features/loans/utils/loanInsights';
import { ProgressRing } from '@shared/ui';
import { FiActivity } from 'react-icons/fi';

interface LoanHealthScoreProps {
  health: LoanHealthScoreResult;
}

const bandColors: Record<LoanHealthScoreResult['band'], string> = {
  excellent: '#22c55e',
  moderate: '#eab308',
  needs_attention: '#ef4444',
};

const bandLabelKeys: Record<LoanHealthScoreResult['band'], string> = {
  excellent: 'loan.health.excellent',
  moderate: 'loan.health.moderate',
  needs_attention: 'loan.health.needsAttention',
};

const LoanHealthScore: React.FC<LoanHealthScoreProps> = ({ health }) => {
  const { t } = useLocalization();
  const color = bandColors[health.band];

  return (
    <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl p-5 shadow-lg h-full">
      <div className="flex items-center gap-2 mb-4">
        <FiActivity className="text-lg text-[var(--color-app-accent)]" />
        <h3 className="text-base font-semibold text-white m-0">
          {t('loan.health.title')}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div style={{ ['--color-app-accent' as string]: color }}>
          <ProgressRing
            value={health.score}
            max={100}
            size={88}
            strokeWidth={6}
            label={t('loan.health.title')}
          />
        </div>
        <div
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color }}
        >
          {t(bandLabelKeys[health.band])}
        </div>
        <p className="text-sm text-white/55 text-center m-0 leading-relaxed">
          {t(health.explanationKey)}
        </p>
      </div>
    </div>
  );
};

export default LoanHealthScore;
