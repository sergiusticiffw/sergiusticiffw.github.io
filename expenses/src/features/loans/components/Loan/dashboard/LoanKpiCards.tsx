import React from 'react';
import { StatCard, StatsGrid } from '@shared/components/Common';
import { formatNumber } from '@shared/utils/utils';
import { useLocalization } from '@shared/context/localization';
import { FiCreditCard, FiCheck, FiClock, FiPieChart } from 'react-icons/fi';

interface LoanKpiCardsProps {
  principal: number;
  paidAmount: number;
  remainingDisplay: string;
  interestToPrincipalRatio: number;
  loanStatus: string;
}

const LoanKpiCards: React.FC<LoanKpiCardsProps> = ({
  principal,
  paidAmount,
  remainingDisplay,
  interestToPrincipalRatio,
  loanStatus,
}) => {
  const { t } = useLocalization();

  const paidDisplay =
    loanStatus === 'pending' ? t('loan.notStarted') : formatNumber(paidAmount);

  const ratioDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : `${formatNumber(interestToPrincipalRatio)}%`;

  return (
    <StatsGrid columns={4}>
      <StatCard
        icon={<FiCreditCard />}
        value={formatNumber(principal)}
        label={t('loan.principal')}
      />
      <StatCard
        icon={<FiCheck />}
        value={paidDisplay}
        label={t('loan.paid')}
        accent
      />
      <StatCard
        icon={<FiClock />}
        value={remainingDisplay}
        label={t('loan.remaining')}
      />
      <StatCard
        icon={<FiPieChart />}
        value={ratioDisplay}
        label={t('loan.kpi.interestRatio')}
      />
    </StatsGrid>
  );
};

export default LoanKpiCards;
