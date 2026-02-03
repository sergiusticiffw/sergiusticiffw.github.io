import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import {
  FiEdit2,
  FiTrash2,
  FiMove,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import { formatNumber, getLocale, hasTag } from '@shared/utils/utils';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { incomeSuggestions } from '@shared/utils/constants';
import TagDisplay from '@shared/components/Common/TagDisplay';
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import { useLocalization } from '@shared/context/localization';

interface IncomeTableProps {
  items: TransactionOrIncomeItem[];
  handleEdit: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
  changedItems?: any;
  handleClearChangedItem?: any;
  pendingSyncIds?: Record<string, true>;
}

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const IncomeTable: React.FC<IncomeTableProps> = ({
  items,
  handleEdit,
  setShowDeleteModal,
  handleClearChangedItem,
  changedItems,
  pendingSyncIds,
}) => {
  const listRef = useRef<any>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { t, language } = useLocalization();

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  useEffect(() => {
    Object.keys(changedItems).forEach((id) => {
      const timer = setTimeout(() => {
        handleClearChangedItem(id);
      }, 2000);
      return () => clearTimeout(timer);
    });
  }, [changedItems, handleClearChangedItem]);

  const allItems = useMemo(
    () => [
      ...items,
      ...Object.values(changedItems || {})
        .filter(
          (item: any) => item.type === 'removed' && item.data.type === 'incomes'
        )
        .map((item: any) => item.data),
    ],
    [items, changedItems]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField, sortDirection]
  );

  // Sort items
  const sortedItems = useMemo(() => {
    return [...allItems].sort((a, b) => {
      if (!sortField) {
        // Default sort by date descending
        return new Date(b.dt).getTime() - new Date(a.dt).getTime();
      }

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
  }, [allItems, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove />;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  const sortBtn =
    'flex items-center gap-1.5 py-2 px-4 bg-white/[0.05] border border-white/10 rounded-lg text-white/60 text-[0.85rem] font-medium cursor-pointer transition-all duration-200 [&_svg]:text-xs [&_svg]:opacity-70 hover:bg-white/10 hover:border-white/15 hover:text-white/80';
  const sortBtnActive =
    'bg-[rgba(91,141,239,0.15)] border-[rgba(91,141,239,0.3)] text-[#5b8def] [&_svg]:opacity-100';

  return (
    <div
      className="w-full relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
      ref={listRef}
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white m-0 mb-4 tracking-tight text-center">
          {t('income.incomeRecords')}
        </h3>
        <div className="flex gap-2">
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
      </div>

      <div className="flex flex-col gap-3">
        {sortedItems.map((income) => {
          const changeType = changedItems[income.id]?.type;
          const date = new Date(income.dt);
          const day = date.getDate();
          const locale = getLocale(language);
          const month = date
            .toLocaleDateString(locale, { month: 'short' })
            .toUpperCase();
          const year = date.getFullYear();

          const isThisItemSwiped = swipedItemId === income.id;
          const isPending =
            !!pendingSyncIds?.[income.id] ||
            (typeof income.id === 'string' && income.id.startsWith('temp_'));

          return (
            <div
              key={income.id}
              className={`relative overflow-hidden rounded-xl ${changeType === 'added' ? 'animate-[slideIn_0.3s_ease]' : ''} ${changeType === 'removed' ? 'animate-[slideOut_0.3s_ease] opacity-50' : ''}`}
            >
              <div
                className={`swipe-actions-background ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
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
                data-id={income.id}
                className="flex items-center gap-4 py-4 px-4 rounded-xl bg-white/[0.05] cursor-pointer transition-all duration-200 relative z-[1] border border-white/10 hover:bg-white/10"
                onTouchStart={(e) => handleTouchStart(e, income.id, listRef)}
                onTouchMove={(e) => handleTouchMove(e, listRef)}
                onTouchEnd={(e) =>
                  handleTouchEnd(
                    e,
                    listRef,
                    income.id,
                    handleEdit,
                    setShowDeleteModal
                  )
                }
              >
                <div className="flex flex-col items-center shrink-0 min-w-[3rem]">
                  <div className="text-lg font-bold text-white leading-none">{day}</div>
                  <div className="text-xs font-semibold text-white/50 mt-0.5 tracking-wide">{month}</div>
                  <div className="text-xs text-white/40 mt-0.5">{year}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-white/90 leading-snug break-words">
                    <TagDisplay
                      description={income.dsc || ''}
                      suggestions={incomeSuggestions}
                      getTagLabel={(tag) => t(`income.tags.${tag}`) || tag}
                      translationKey="income.tags"
                    />
                  </div>
                </div>

                <div className="text-lg font-bold text-white shrink-0 flex items-center gap-1">
                  {formatNumber(income.sum)}
                  <ItemSyncIndicator
                    status={isPending ? 'pending' : undefined}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(IncomeTable);
