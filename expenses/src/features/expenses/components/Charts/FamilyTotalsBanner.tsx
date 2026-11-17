import React from 'react';
import { useLocalization } from '@shared/context/localization';
import type { FamilyTotalsSource } from './useFamilySharedTotals';

export interface FamilyTotalsBannerProps {
  totalsSource: FamilyTotalsSource;
  personalOnly?: boolean;
  className?: string;
}

/** Explains when Family charts show personal-only or encryption-limited data. */
const FamilyTotalsBanner: React.FC<FamilyTotalsBannerProps> = ({
  totalsSource,
  personalOnly = false,
  className = '',
}) => {
  const { t } = useLocalization();

  let message: string | null = null;
  if (personalOnly) {
    message = t('family.bannerPersonalFilter');
  } else if (totalsSource === 'encryption_local') {
    message = t('family.bannerEncryption');
  } else if (totalsSource === 'personal_fallback') {
    message = t('family.bannerPersonalFallback');
  }

  if (!message) return null;

  return (
    <p
      className={`mx-4 mb-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-snug text-app-muted ${className}`}
      role="status"
    >
      {message}
    </p>
  );
};

export default FamilyTotalsBanner;
