import { categories, monthNames } from '@utils/constants';
import {
  AuthState,
  ActionType,
  TransactionOrIncomeItem,
  Accumulator,
  DataItems,
} from '@type/types';

const user = localStorage.getItem('currentUser')
  ? JSON.parse(localStorage.getItem('currentUser')!)
  : '';
const token = localStorage.getItem('currentUser')
  ? JSON.parse(localStorage.getItem('currentUser')!).jwt_token
  : '';
const theme = localStorage.getItem('theme')
  ? JSON.parse(localStorage.getItem('theme')!)
  : '';

const useChartsBackgroundColor = localStorage.getItem(
  'useChartsBackgroundColor'
)
  ? JSON.parse(localStorage.getItem('useChartsBackgroundColor')!)
  : '';

export const initialState = {
  userDetails: user || '',
  token: token || '',
  loading: false,
  errorMessage: null,
  userIsLoggedIn: !!user,
  currency: user?.current_user?.currency || 'MDL',
  theme: theme || 'blue-pink-gradient',
  useChartsBackgroundColor,
};

export const initialData = {
  groupedData: null,
  totals: null,
  filtered: null,
  raw: [],
  incomeData: null,
  incomeTotals: null,
  categoryTotals: [],
  loading: true,
  totalSpent: 0,
  changedItems: {},
  category: '',
  textFilter: '',
  selectedMonth: '',
  selectedTag: '',
};

export const initialLoanData = {
  loans: null,
  loading: true,
  payments: [],
};

export const AuthReducer = (initialState: AuthState, action: ActionType) => {
  switch (action.type) {
    case 'REQUEST_LOGIN':
      return {
        ...initialState,
        loading: true,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...initialState,
        userDetails: action.payload,
        token: action.payload.jwt_token,
        loading: false,
        userIsLoggedIn: true,
        currency: action.payload.current_user.currency || 'MDL',
      };
    case 'UPDATE_USER':
      return {
        ...initialState,
        ...action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        user: '',
        token: '',
        userIsLoggedIn: false,
      };

    case 'LOGIN_ERROR':
      return {
        ...initialState,
        loading: false,
        errorMessage: action.error,
      };

    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
};

// Helper function to apply filters to raw data
const applyFilters = (
  raw: TransactionOrIncomeItem[],
  category: string,
  textFilter: string,
  selectedMonth: string,
  selectedTag: string
) => {
  if (
    !(
      category !== '' ||
      textFilter !== '' ||
      selectedMonth !== '' ||
      selectedTag !== ''
    ) ||
    !raw
  ) {
    return null;
  }

  let filtered =
    raw?.filter(
      (item: TransactionOrIncomeItem) => item.type === 'transaction'
    ) || [];

  if (category) {
    filtered = filtered.filter((item) => item.cat === category);
  }

  if (textFilter) {
    const textFilterLower = textFilter.toLowerCase();
    filtered = filtered.filter(
      (item: TransactionOrIncomeItem) =>
        item.dsc && item.dsc.toLowerCase().includes(textFilterLower)
    );
  }

  if (selectedMonth) {
    filtered = filtered.filter((item: TransactionOrIncomeItem) => {
      const itemDate = new Date(item.dt);
      const selectedDate = new Date(selectedMonth + '-01');
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth();
      const selectedYear = selectedDate.getFullYear();
      const selectedMonthNum = selectedDate.getMonth();
      return itemYear === selectedYear && itemMonth === selectedMonthNum;
    });
  }

  if (selectedTag) {
    // Use exact tag match with word boundaries to avoid partial matches
    const hasTag = (item: TransactionOrIncomeItem, tag: string): boolean => {
      if (!item.dsc || !tag) return false;
      const tagPattern = new RegExp(
        `#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i'
      );
      return tagPattern.test(item.dsc);
    };
    filtered = filtered.filter((item: TransactionOrIncomeItem) => {
      return hasTag(item, selectedTag);
    });
  }

  const newState = filtered.reduce(
    (accumulator: Accumulator, item: TransactionOrIncomeItem) => {
      const date = new Date((item as TransactionOrIncomeItem).dt);
      const year = date.getFullYear();
      const month = `${monthNames[date.getMonth()]} ${year}`;
      accumulator.groupedData[month] =
        accumulator.groupedData[month] || [];
      accumulator.groupedData[month].push(item as TransactionOrIncomeItem);

      accumulator.totals[month] =
        (accumulator.totals[month] || 0) +
        parseFloat((item as TransactionOrIncomeItem).sum);
      accumulator.totalSpent =
        accumulator.totalSpent +
        parseFloat((item as TransactionOrIncomeItem).sum);

      accumulator.totalsPerYearAndMonth[year] =
        accumulator.totalsPerYearAndMonth[year] || {};
      accumulator.totalsPerYearAndMonth[year][month] =
        (accumulator.totalsPerYearAndMonth[year][month] || 0) +
        parseFloat(item.sum);

      accumulator.totalPerYear[year] =
        ((accumulator.totalPerYear[year] as number) || 0) +
        parseFloat((item as TransactionOrIncomeItem).sum);

      const cat = (item as TransactionOrIncomeItem).cat;
      if (cat !== undefined) {
        if (!accumulator.categoryTotals[cat]) {
          accumulator.categoryTotals[cat] = {
            name: '',
            y: 0,
          };
        }
        accumulator.categoryTotals[cat].name =
          // @ts-expect-error YBC
          categories[cat]?.label || '';
        accumulator.categoryTotals[cat].y +=
          parseFloat((item as TransactionOrIncomeItem).sum) || 0;
      }

      return accumulator;
    },
    {
      groupedData: {},
      totals: {},
      totalsPerYearAndMonth: {},
      totalPerYear: {},
      totalSpent: 0,
      categoryTotals: {},
    }
  );

  return {
    filtered: newState,
    filtered_raw: filtered,
  };
};

export const DataReducer = (initialState: DataItems, action: ActionType) => {
  switch (action.type) {
    case 'SET_DATA':
      const changedItems = compareData(initialState.raw, action.raw);
      const newState = {
        ...initialState,
        ...action,
        changedItems: {
          ...initialState.changedItems,
          ...changedItems,
        },
      };

      // Reapply filters if they were active
      if (
        initialState.category ||
        initialState.textFilter ||
        initialState.selectedMonth ||
        initialState.selectedTag
      ) {
        const filterResult = applyFilters(
          action.raw || newState.raw || [],
          initialState.category || '',
          initialState.textFilter || '',
          initialState.selectedMonth || '',
          initialState.selectedTag || ''
        );

        if (filterResult) {
          return {
            ...newState,
            ...filterResult,
            category: initialState.category,
            textFilter: initialState.textFilter,
            selectedMonth: initialState.selectedMonth,
            selectedTag: initialState.selectedTag,
          };
        }
      }

      return newState;

    case 'CLEAR_CHANGED_ITEM':
      const newChangedItems = { ...initialState.changedItems };
      delete newChangedItems[action.id];
      return {
        ...initialState,
        changedItems: newChangedItems,
      };

    case 'FILTER_DATA':
      const filterResult = applyFilters(
        initialState.raw || [],
        action.category || '',
        action.textFilter || '',
        action.selectedMonth || '',
        action.selectedTag || ''
      );

      if (filterResult) {
        return {
          ...initialState,
          ...filterResult,
          category: action.category,
          textFilter: action.textFilter,
          selectedMonth: action.selectedMonth,
          selectedTag: action.selectedTag,
        };
      }

      return {
        ...initialState,
        filtered: null,
        category: '',
        textFilter: '',
        selectedMonth: '',
        selectedTag: '',
        filtered_raw: null,
      };

    case 'REMOVE_DATA':
      return initialData;

    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
};

// Optimized data comparison - avoids JSON.stringify for better performance
const compareData = (oldData, newData) => {
  const changedItems = {};
  // Handle null/undefined cases
  if (!oldData || !Array.isArray(oldData) || oldData.length === 0) {
    return changedItems;
  }
  if (!newData || !Array.isArray(newData)) {
    return changedItems;
  }
  const oldMap = new Map(oldData.map((item) => [item.id, item]));
  const newMap = new Map(newData.map((item) => [item.id, item]));

  newData.forEach((item) => {
    const oldItem = oldMap.get(item.id);
    if (!oldItem) {
      changedItems[item.id] = { type: 'new', data: item };
    } else {
      // Compare fields directly instead of JSON.stringify for better performance
      const hasChanged =
        item.dt !== oldItem.dt ||
        item.sum !== oldItem.sum ||
        item.type !== oldItem.type ||
        item.cat !== oldItem.cat ||
        item.dsc !== oldItem.dsc ||
        item.cr !== oldItem.cr;

      if (hasChanged) {
        changedItems[item.id] = { type: 'updated', data: item };
      }
    }
  });

  oldData.forEach((item) => {
    if (!newMap.has(item.id)) {
      changedItems[item.id] = { type: 'removed', data: item };
    }
  });

  return changedItems;
};

export const LoanReducer = (initialState, action) => {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...initialState,
        loans: action.loans,
        payments: action.payments,
        loading: action.loading,
      };
  }
};
