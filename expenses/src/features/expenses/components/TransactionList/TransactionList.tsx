import React, { useRef, useState, useMemo, useCallback } from 'react';
import { getIconForCategory } from '@shared/utils/helper';
import {
  formatNumber,
  getLocale,
  getSuggestionTranslationKey,
} from '@shared/utils/utils';
import { useLocalization } from '@shared/context/localization';
import { getSuggestions } from '@shared/utils/constants';
import { normalizeTag } from '@shared/hooks/useTags';
import TagDisplay from '@shared/components/Common/TagDisplay';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import {
  FiEdit2,
  FiTrash2,
  FiMove,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';

interface Transaction {
  id: string;
  dsc: string;
  sum: number | string;
  cat: string;
  dt: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  categoryLabels: Array<{ value: string; label: string }>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  pendingSyncIds?: Record<string, true>;
}

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categoryLabels,
  onEdit,
  onDelete,
  pendingSyncIds,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { language, t } = useLocalization();

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  const getCategoryLabel = (catValue: string) => {
    return (
      categoryLabels.find((cat) => cat.value === catValue)?.label || catValue
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort transactions
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'date') {
      const dateA = new Date(a.dt).getTime();
      const dateB = new Date(b.dt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortField === 'amount') {
      const amountA = typeof a.sum === 'string' ? parseFloat(a.sum) : a.sum;
      const amountB = typeof b.sum === 'string' ? parseFloat(b.sum) : b.sum;
      return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
    }

    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove />;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  const sortBtn =
    'rounded-lg py-2 px-4 text-white/60 text-sm cursor-pointer flex items-center gap-2 transition-all duration-200 bg-white/[0.05] border-none hover:bg-white/10 hover:text-white/80 [&_svg]:text-sm';
  const sortBtnActive =
    'bg-[rgba(91,141,239,0.2)] text-[#5b8def] font-medium';

  return (
    <div
      className="flex flex-col gap-2 w-full relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
      ref={listRef}
    >
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className={`${sortBtn} ${sortField === 'date' ? sortBtnActive : ''}`}
          onClick={() => handleSort('date')}
        >
          Date {getSortIcon('date')}
        </button>
        <button
          type="button"
          className={`${sortBtn} ${sortField === 'amount' ? sortBtnActive : ''}`}
          onClick={() => handleSort('amount')}
        >
          Amount {getSortIcon('amount')}
        </button>
      </div>

      {sortedTransactions.map((transaction) => {
        const categoryLabel = getCategoryLabel(transaction.cat);
        const date = new Date(transaction.dt);
        const day = date.getDate();
        const locale = getLocale(language);
        const month = date
          .toLocaleDateString(locale, { month: 'short' })
          .toUpperCase();

        const isThisItemSwiped = swipedItemId === transaction.id;
        const isPending =
          !!pendingSyncIds?.[transaction.id] ||
          (typeof transaction.id === 'string' &&
            transaction.id.startsWith('temp_'));

        return (
          <div key={transaction.id} className="relative w-full rounded-2xl overflow-hidden">
            <div
              className={`swipe-actions-background rounded-2xl ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
            >
              {isThisItemSwiped && deleteVisible && (
                <div className="delete-action-bg">
                  <FiTrash2 />
                </div>
              )}
              {isThisItemSwiped && editVisible && (
                <div className="edit-action-bg">
                  <FiEdit2 />
                </div>
              )}
            </div>

            <div
              data-id={transaction.id}
              className="bg-white/[0.05] rounded-2xl py-4 pr-6 pl-4 flex items-start gap-4 cursor-pointer transition-all duration-200 relative z-[1] w-full min-h-0 touch-pan-y overflow-hidden hover:bg-white/10 hover:translate-x-1 active:scale-[0.98]"
              style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
              onTouchStart={(e) => handleTouchStart(e, transaction.id, listRef)}
              onTouchMove={(e) => handleTouchMove(e, listRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(
                  e,
                  listRef,
                  transaction.id,
                  onEdit || (() => {}),
                  onDelete || (() => {})
                )
              }
            >
              <div className="flex flex-col items-center justify-center min-w-[50px] shrink-0">
                <div className="text-2xl font-bold text-white leading-none">{day}</div>
                <div className="text-xs font-semibold text-white/50 mt-1 tracking-wide">{month}</div>
              </div>

              <div className="flex items-center justify-center min-w-[80px] max-w-[100px] bg-white/10 rounded-xl py-2 px-3 shrink-0">
                <div className="text-xs font-medium text-white/70 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                  {categoryLabel}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-white/90 leading-snug break-words">
                  <TagDisplay
                    description={transaction.dsc || ''}
                    suggestions={(() => {
                      const suggestions = getSuggestions();
                      return (
                        suggestions[
                          transaction.cat as keyof typeof suggestions
                        ] || []
                      );
                    })()}
                    normalizeTag={normalizeTag}
                    getTagLabel={(suggestion) => {
                      const translationKey = getSuggestionTranslationKey(
                        suggestion,
                        transaction.cat
                      );
                      const translated = t(translationKey);
                      return translated !== translationKey
                        ? translated
                        : suggestion;
                    }}
                  />
                </div>
              </div>

              <div className="text-lg font-bold text-white whitespace-nowrap pr-2 shrink-0 flex items-center gap-1">
                {formatNumber(transaction.sum)}
                <ItemSyncIndicator status={isPending ? 'pending' : undefined} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(TransactionList);
