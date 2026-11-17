import { useEffect, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { FiChevronRight, FiPieChart } from 'react-icons/fi';
import { useLoan } from '@stores/loanStore';
import { useEmergencyFund } from '@features/goals/store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { formatNumber } from '@shared/utils/utils';
import { computeLoanLiabilities } from '../loanLiabilities';
import { buildNetWorth } from '../model';
import { useNetWorthAssets } from '../assetsStore';

const NetWorthCard = () => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const fund = useEmergencyFund();
  const assetsState = useNetWorthAssets();
  const { data, dataDispatch } = useLoan();
  const apiClient = useApiClient();

  useEffect(() => {
    if (!data.loans && apiClient) {
      fetchLoansService(apiClient, dataDispatch);
    }
  }, [data.loans, apiClient, dataDispatch]);

  const snapshot = useMemo(
    () =>
      buildNetWorth({
        emergencyFund: fund.balance,
        cash: 0,
        customAssets: assetsState.items,
        loans: computeLoanLiabilities(data.loans, data.payments),
      }),
    [fund.balance, assetsState.items, data.loans, data.payments]
  );

  return (
    <Link
      to="/expenses/net-worth"
      className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-left no-underline transition-colors hover:bg-white/[0.07]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]">
        <FiPieChart size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs uppercase tracking-wider text-app-muted">
          {t('netWorth.netWorth')}
        </span>
        <span
          className={`mt-0.5 block text-xl font-extrabold tabular-nums tracking-tight ${
            snapshot.netWorth >= 0
              ? 'text-app-primary'
              : 'text-[var(--color-expense)]'
          }`}
        >
          {formatNumber(snapshot.netWorth)}{' '}
          <span className="text-sm font-medium text-app-muted">{currency}</span>
        </span>
      </span>
      <FiChevronRight className="shrink-0 text-app-muted" aria-hidden />
    </Link>
  );
};

export default NetWorthCard;
