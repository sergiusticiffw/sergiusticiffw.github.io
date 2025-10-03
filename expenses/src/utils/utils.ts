import { categories } from '@utils//constants';
import { logout } from '@context/actions';
import { DataStructure, ItemTotal, TransactionOrIncomeItem } from '@type/types';

// API Configuration
export const API_BASE_URL = 'https://dev-expenses-api.pantheonsite.io';

const handleErrors = (
  response: Response,
  options: RequestInit,
  dataDispatch: any,
  dispatch: any
) => {
  if (!response.ok) {
    fetch(`${API_BASE_URL}/jwt/token`, options).then((response) => {
      if (response.status === 403) {
        // Add null checks before calling logout
        if (dispatch && dataDispatch) {
          logout(dispatch, dataDispatch);
        } else {
          console.error('Dispatch functions not available for logout');
        }
      }
    });
    return response.statusText;
  }

  // Check if response has content before trying to parse JSON
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');

  // If response is empty or doesn't have JSON content, return null
  if (
    !contentType ||
    !contentType.includes('application/json') ||
    contentLength === '0'
  ) {
    return null;
  }

  // For successful responses, return the response object to be handled by the caller
  return response;
};

/**
 * Generic API fetch helper
 * Creates a standardized fetch request with authentication headers
 */
export const createAuthenticatedFetchOptions = (
  token: string,
  method: string = 'GET'
): RequestInit => {
  return {
    method,
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
};

/**
 * Generic API fetch wrapper
 * Handles common API call patterns with authentication and error handling
 */
export const fetchFromAPI = <T = any>(
  url: string,
  token: string,
  dataDispatch: any,
  dispatch: any,
  onSuccess: (data: T) => void,
  method: string = 'GET'
) => {
  const fetchOptions = createAuthenticatedFetchOptions(token, method);
  fetchRequest(url, fetchOptions, dataDispatch, dispatch, onSuccess);
};

export const formatDataForChart = (
  data: DataStructure,
  secondSet = false,
  localizedMonthNames?: string[]
) => {
  const seriesData = [];

  // English month names (used in data structure)
  const englishMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  for (const year in data) {
    const yearSeries = {
      name: year,
      data: [],
    };

    // Use localized month names if provided, otherwise fall back to English
    const monthsToUse = localizedMonthNames || englishMonthNames;

    for (let i = 0; i < monthsToUse.length; i++) {
      const displayMonth = monthsToUse[i];
      const englishMonth = englishMonthNames[i];
      const monthValue = data[year][`${englishMonth} ${year}`];

      if (secondSet) {
        // @ts-ignore
        const monthValueSpent = secondSet[year][`${englishMonth} ${year}`];
        // @ts-expect-error TBD
        yearSeries.data.push([displayMonth, monthValue - monthValueSpent]);
      } else {
        // @ts-expect-error TBD
        yearSeries.data.push([displayMonth, monthValue]);
      }
    }

    if (yearSeries.data.length > 0) {
      seriesData.push(yearSeries);
    }
  }

  return seriesData;
};

export const fetchRequest = (
  url: string,
  options: RequestInit,
  dataDispatch: any,
  dispatch: any,
  callback: any
) => {
  // Add null checks for dispatch functions
  if (!dataDispatch || !dispatch) {
    console.error('Dispatch functions not available for fetch request');
    return;
  }

  fetch(url, options)
    .then((response) => handleErrors(response, options, dataDispatch, dispatch))
    .then((result) => {
      // If handleErrors returned a string (error), pass it to callback
      if (typeof result === 'string') {
        return callback(result);
      }

      // If handleErrors returned null (empty response), pass null to callback
      if (result === null) {
        return callback(null);
      }

      // If handleErrors returned a response object, try to parse JSON
      if (result instanceof Response) {
        return result.text().then((text) => {
          if (!text || text.trim() === '') {
            return callback(null);
          }
          try {
            const data = JSON.parse(text);
            return callback(data);
          } catch (error) {
            console.warn('Failed to parse JSON response:', error);
            return callback(null);
          }
        });
      }

      // For any other case, pass the result to callback
      return callback(result);
    })
    .catch((error) => console.log(error));
};

export const deleteNode = (nid: string, token: string, callback: any) => {
  const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
  fetch(`${API_BASE_URL}/node/${nid}?_format=json`, fetchOptions).then(
    (response) => {
      callback(response);
    }
  );
};

export const deleteLoan = (
  nid: string,
  token: string,
  dataDispatch: any,
  dispatch: any,
  onSuccess: () => void
) => {
  // Add null checks for dispatch functions
  if (!dataDispatch || !dispatch) {
    console.error('Dispatch functions not available for delete loan');
    return;
  }

  fetchFromAPI(
    `${API_BASE_URL}/node/${nid}?_format=json`,
    token,
    dataDispatch,
    dispatch,
    onSuccess,
    'DELETE'
  );
};

export const fetchData = (
  token: string,
  dataDispatch: any,
  dispatch: any,
  category: string = '',
  textFilter: string = ''
) => {
  fetchFromAPI<TransactionOrIncomeItem[]>(
    `${API_BASE_URL}/api/expenses`,
    token,
    dataDispatch,
    dispatch,
    (data) => {
      const groupedData: Record<string, TransactionOrIncomeItem[]> = {};
      const totalsPerYearAndMonth: DataStructure = {};
      const totalPerYear: ItemTotal = {};
      const incomeData: TransactionOrIncomeItem[] = [];
      const monthsTotals: Record<string, number> = {};
      const incomeTotals: Record<string, number> = {};
      const totalIncomePerYear: ItemTotal = {};
      const totalIncomePerYearAndMonth: DataStructure = {};
      const categoryTotals:
        | Record<string, { name: string; y: number }>
        | never[] = {};
      let totalSpent = 0;
      const updateYearAndMonth = (year: string | number, month: string) => {
        if (!totalsPerYearAndMonth[year]) {
          totalsPerYearAndMonth[year] = {};
        }
        if (!totalsPerYearAndMonth[year][month]) {
          totalsPerYearAndMonth[year][month] = 0;
        }
        if (!groupedData[month]) {
          groupedData[month] = [];
        }
        if (!monthsTotals[month]) {
          monthsTotals[month] = 0;
        }
        if (!incomeTotals[month]) {
          incomeTotals[month] = 0;
        }
        if (!totalIncomePerYearAndMonth[year]) {
          totalIncomePerYearAndMonth[year] = {};
        }
        if (!totalIncomePerYearAndMonth[year][month]) {
          totalIncomePerYearAndMonth[year][month] = 0;
        }
        if (!totalIncomePerYear[year]) {
          totalIncomePerYear[year] = 0;
        }
        if (!totalPerYear[year]) {
          totalPerYear[year] = 0;
        }
      };

      const updateTotals = (
        item: TransactionOrIncomeItem,
        year: number | string,
        month: string
      ) => {
        const { cat, sum, type } = item;
        if (type === 'incomes') {
          totalIncomePerYear[year] =
            (totalIncomePerYear[year] as number) + parseFloat(sum);
          totalIncomePerYearAndMonth[year][month] += parseFloat(sum);
          incomeData.push(item);
          incomeTotals[month] = parseFloat(
            (incomeTotals[month] + parseFloat(sum)).toFixed(2)
          );
        } else if (type === 'transaction') {
          groupedData[month].push(item);
          monthsTotals[month] = parseFloat(
            (monthsTotals[month] + parseFloat(sum)).toFixed(2)
          );
          if (cat && categoryTotals[cat]) {
            const categoryKey = cat as keyof typeof categories;
            // @ts-expect-error
            categoryTotals[categoryKey].name = getCategory[cat];
            // @ts-expect-error
            categoryTotals[categoryKey].y = parseFloat(
              // @ts-expect-error
              (categoryTotals[categoryKey].y + parseFloat(sum)).toFixed(2)
            );
          }
          totalSpent = totalSpent + parseFloat(sum);
          totalsPerYearAndMonth[year][month] += parseFloat(sum);
          totalPerYear[year] = (totalPerYear[year] as number) + parseFloat(sum);
        }
      };
      if (data) {
        data.forEach((item: TransactionOrIncomeItem) => {
          const { dt, cat } = item;
          const date = new Date(dt);
          const year = date.getFullYear();
          // Use English month names for data processing (this is for internal use)
          const englishMonthNames = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];
          const month = `${englishMonthNames[date.getMonth()]} ${year}`;

          if (cat && !categoryTotals[cat]) {
            categoryTotals[cat] = {
              name: '',
              y: 0,
            };
          }
          updateYearAndMonth(year, month);
          updateTotals(item, year, month);
        });
      }
      dataDispatch({
        type: 'SET_DATA',
        raw: data,
        groupedData: groupedData,
        totals: monthsTotals,
        incomeData: incomeData,
        incomeTotals: incomeTotals,
        categoryTotals: categoryTotals,
        loading: false,
        totalsPerYearAndMonth,
        totalIncomePerYear,
        totalIncomePerYearAndMonth,
        totalPerYear,
        totalSpent,
      });
      if (category || textFilter) {
        dataDispatch({
          type: 'FILTER_DATA',
          category: category,
          textFilter,
        });
      }
    }
  );
};

export const fetchLoans = (token: string, dataDispatch: any, dispatch: any) => {
  // Add null checks for dispatch functions
  if (!dataDispatch || !dispatch) {
    console.error('Dispatch functions not available for fetch loans');
    return;
  }

  fetchFromAPI(
    `${API_BASE_URL}/api/loans`,
    token,
    dataDispatch,
    dispatch,
    async (data) => {
      const fetchOptions = createAuthenticatedFetchOptions(token);
      if (data.length > 0) {
        const paymentPromises = data.map((item) =>
          fetch(`${API_BASE_URL}/api/payments/${item.id}`, fetchOptions)
            .then((response) => response.json())
            .then((responseData) => ({ loanId: item.id, data: responseData }))
        );
        const payments = await Promise.all(paymentPromises);
        dataDispatch({
          type: 'SET_DATA',
          loans: data,
          payments,
          loading: false,
        });
      } else {
        dataDispatch({
          type: 'SET_DATA',
          loans: null,
          payments: [],
          loading: false,
        });
      }
    }
  );
};

export const formatNumber = (value: unknown): string => {
  // Get user's language preference from localStorage or default to 'en'
  const language = localStorage.getItem('language') || 'en';
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';

  if (typeof value === 'number') {
    // Handle numbers directly
    return value.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } else if (typeof value === 'string') {
    // Parse the string as a number
    const parsedValue = parseFloat(value);
    if (!isNaN(parsedValue)) {
      return parsedValue.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }

  // Handle invalid input
  return '-';
};

export const getCategory: { [key: string]: string } = categories.reduce(
  (acc, item) => {
    // @ts-expect-error TBC
    acc[item.value] = item.label;
    return acc;
  },
  {}
);

export const getMonthsPassed = (firstDay: string | number | Date): number => {
  const daysPassed = parseInt(
    String((new Date().getTime() - new Date(firstDay).getTime()) / 86400000 + 1)
  );
  return daysPassed ? parseFloat(String(daysPassed / 30.42)) : 0;
};

export const transformToNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return value?.includes('.') ? parseFloat(value) : parseInt(value, 10);
};

export const transformDateFormat = (dateString: string): string => {
  const [year, month, day] = dateString.split('-');
  return `${day}.${month}.${year}`;
};

export const addOneDay = (dateStr: string) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

// Helper function to format month as "January 2024".
export const formatMonth = (date: Date) => {
  // Get user's language preference from localStorage or default to 'en'
  const language = localStorage.getItem('language') || 'en';
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';

  return new Date(date.getFullYear(), date.getMonth(), 1).toLocaleString(
    locale,
    { month: 'long', year: 'numeric' }
  );
};

export const calculateDaysFrom = (
  firstDate: string | number | Date,
  dateString: string | number | Date | null = null
) => {
  const givenDate = new Date(firstDate); // Parse the input date string
  const currentDate = !dateString ? new Date() : new Date(dateString); // Get the current date

  // Calculate the difference in time (in milliseconds)
  const timeDifference = currentDate - givenDate;

  // Convert milliseconds to days (1 day = 24 * 60 * 60 * 1000 ms)
  const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

  return daysDifference;
};
