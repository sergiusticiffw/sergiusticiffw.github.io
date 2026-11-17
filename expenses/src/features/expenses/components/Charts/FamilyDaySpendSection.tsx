import React, { useMemo } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useSettingsCurrency } from '@stores/settingsStore';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import type { FamilyCategoryDailyTotal, HouseholdMember } from '../../../../data';
import {
  partnerCategorySpendForDay,
  partnerUserIdsForDay,
  sameUserId,
} from './familyTotals';
import FamilyTotalsBanner from './FamilyTotalsBanner';
import type { FamilyTotalsSource } from './useFamilySharedTotals';

export type FamilyDaySpendSectionProps = {
  dayKey: string;
  rows: FamilyCategoryDailyTotal[];
  myUid: string;
  members?: HouseholdMember[];
  sharedCategoryIds: Set<string>;
  totalsSource: FamilyTotalsSource;
  loading?: boolean;
};

const partnerHeading = (
  partnerIds: string[],
  members: HouseholdMember[],
  fallback: string
): string => {
  if (partnerIds.length !== 1) return fallback;
  const id = partnerIds[0];
  const member = members.find((m) => sameUserId(m.user_id, id));
  if (!member) return fallback;
  const label =
    (member.display_name || '').trim() ||
    (member.email || '').trim() ||
    (member.name || '').trim();
  return label || fallback;
};

/** Other members' shared-category spend for one day (no tx details, excludes me). */
const FamilyDaySpendSection: React.FC<FamilyDaySpendSectionProps> = ({
  dayKey,
  rows,
  myUid,
  members = [],
  sharedCategoryIds,
  totalsSource,
  loading = false,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const categories = getCategories();

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const blocked =
    !myUid ||
    totalsSource === 'encryption_local' ||
    totalsSource === 'personal_fallback';

  const spendRows = useMemo(() => {
    if (blocked) return [];
    return partnerCategorySpendForDay(
      rows,
      dayKey,
      myUid,
      labelFor,
      getCategoryColor
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
  }, [blocked, rows, dayKey, myUid, categories, t]);

  const partnerIds = useMemo(
    () => (blocked ? [] : partnerUserIdsForDay(rows, dayKey, myUid)),
    [blocked, rows, dayKey, myUid]
  );

  const total = useMemo(
    () => spendRows.reduce((sum, row) => sum + row.amount, 0),
    [spendRows]
  );

  const title = partnerHeading(
    partnerIds,
    members,
    t('family.partnerDaySpentTitle')
  );

  if (sharedCategoryIds.size === 0 && totalsSource === 'none') {
    return null;
  }

  // Encryption / RPC failure: explain why partner spend is missing.
  if (
    !loading &&
    spendRows.length === 0 &&
    (totalsSource === 'encryption_local' ||
      totalsSource === 'personal_fallback')
  ) {
    return (
      <div className="mt-5 border-t border-white/10 pt-4">
        <h4 className="m-0 mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/60">
          {t('family.partnerDaySpentTitle')}
        </h4>
        <FamilyTotalsBanner
          totalsSource={totalsSource}
          className="!mx-0 mb-0"
        />
      </div>
    );
  }

  // Nobody else spent on shared categories this day — stay quiet.
  if (!loading && spendRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h4 className="m-0 text-xs font-semibold uppercase tracking-wider text-white/60">
          {title}
        </h4>
        {total > 0 && (
          <span className="text-sm font-semibold tabular-nums text-white">
            {formatNumber(total)} {currency}
          </span>
        )}
      </div>

      <FamilyTotalsBanner totalsSource={totalsSource} className="!mx-0 mb-2" />

      {loading && spendRows.length === 0 ? (
        <p className="m-0 px-1 text-sm text-white/50">
          {t('family.totalsLoading')}
        </p>
      ) : (
        <ul className="m-0 list-none">
          {spendRows.map((row) => {
            const pct = total > 0 ? (row.amount / total) * 100 : 0;
            return (
              <li
                key={row.id}
                className="border-b border-white/5 px-1 py-2.5 last:border-b-0"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[0.95rem] font-medium text-white">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: row.color || '#94a3b8' }}
                      aria-hidden
                    />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 text-[0.95rem] font-medium tabular-nums text-white">
                    {formatNumber(row.amount)}
                  </span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full bg-white/[0.06]"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: row.color || '#94a3b8',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default FamilyDaySpendSection;
