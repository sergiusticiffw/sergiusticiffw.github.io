import React, { useMemo, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { cn } from '@shared/ui';
import { formatNumber } from '@shared/utils/utils';
import type { FamilyCategoryMemberTotal, HouseholdMember } from '../../../../data';
import type { AiItem } from '../../../../ai/data';
import {
  filterMemberTotals,
  memberSpendForCategory,
  personalMemberSpendForCategory,
  type MemberCategorySpend,
  type SharedCategorySpend,
} from './familyTotals';

export type FamilyCategorySpendListProps = {
  rows: SharedCategorySpend[];
  categoryTotal: number;
  memberTotals: FamilyCategoryMemberTotal[];
  members: HouseholdMember[];
  myUid: string;
  /** When set, only that month’s member split is shown. */
  monthKey?: string | null;
  categoryFilter?: string;
  dateRange?: { start: string; end: string } | null;
  /** Search/tag active → personal-only breakdown. */
  personalOnly?: boolean;
  personalItems?: AiItem[];
};

const memberLabel = (
  userId: string,
  members: HouseholdMember[],
  myUid: string,
  youLabel: string
): { label: string; isYou?: boolean } => {
  if (myUid && userId === myUid) {
    return { label: youLabel, isYou: true };
  }
  const member = members.find((m) => m.user_id === userId);
  const display = (member?.display_name || '').trim();
  if (display) return { label: display };
  const email = (member?.email || '').trim();
  if (email) return { label: email };
  const name = (member?.name || '').trim();
  if (name) return { label: name };
  return { label: `${userId.slice(0, 8)}…` };
};

const FamilyCategorySpendList: React.FC<FamilyCategorySpendListProps> = ({
  rows,
  categoryTotal,
  memberTotals,
  members,
  myUid,
  monthKey = null,
  categoryFilter = '',
  dateRange = null,
  personalOnly = false,
  personalItems = [],
}) => {
  const { t } = useLocalization();
  const [openId, setOpenId] = useState<string | null>(null);

  const scopedMembers = useMemo(
    () =>
      filterMemberTotals(memberTotals, {
        category: categoryFilter,
        dateRange,
        monthKey,
      }),
    [memberTotals, categoryFilter, dateRange, monthKey]
  );

  const youLabel = t('family.memberYou');

  const breakdownFor = (categoryId: string): MemberCategorySpend[] => {
    if (personalOnly) {
      return personalMemberSpendForCategory(
        personalItems,
        categoryId,
        myUid,
        youLabel
      );
    }
    return memberSpendForCategory(
      scopedMembers,
      categoryId,
      (userId) => memberLabel(userId, members, myUid, youLabel),
      { monthKey }
    );
  };

  return (
    <ul className="m-0 list-none border-t border-white/10">
      {rows.map((row) => {
        const pct = categoryTotal > 0 ? (row.amount / categoryTotal) * 100 : 0;
        const open = openId === row.id;
        const membersRows = open ? breakdownFor(row.id) : [];
        const membersTotal = membersRows.reduce((s, m) => s + m.amount, 0);

        return (
          <li
            key={row.id}
            className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
          >
            <button
              type="button"
              className="w-full cursor-pointer border-0 bg-transparent px-4 py-3 text-left"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : row.id)}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[0.95rem] font-medium text-white">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: row.color || '#94a3b8' }}
                    aria-hidden
                  />
                  <span className="truncate">{row.label}</span>
                  <FiChevronDown
                    size={14}
                    className={cn(
                      'shrink-0 text-white/50 transition-transform duration-200',
                      open && 'rotate-180'
                    )}
                    aria-hidden
                  />
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
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: row.color || '#94a3b8',
                  }}
                />
              </div>
            </button>

            {open && (
              <div className="space-y-2 border-t border-white/5 px-4 pb-3 pt-2.5 pl-5">
                <p className="m-0 text-xs text-white/50">
                  {t('family.memberBreakdown')}
                </p>
                {membersRows.length === 0 ? (
                  <p className="m-0 text-xs text-white/50">
                    {t('family.memberBreakdownEmpty')}
                  </p>
                ) : (
                  <ul className="m-0 list-none space-y-2">
                    {membersRows.map((member) => {
                      const memberPct =
                        membersTotal > 0
                          ? (member.amount / membersTotal) * 100
                          : 0;
                      return (
                        <li key={member.userId}>
                          <div className="mb-1 flex items-baseline justify-between gap-3">
                            <span
                              className={cn(
                                'min-w-0 truncate text-xs text-white/70',
                                member.isYou && 'font-semibold text-white'
                              )}
                            >
                              {member.label}
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-white">
                              {formatNumber(member.amount)}
                            </span>
                          </div>
                          <div
                            className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-white/35 transition-[width] duration-500 ease-out"
                              style={{
                                width: `${Math.min(100, memberPct)}%`,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default FamilyCategorySpendList;
