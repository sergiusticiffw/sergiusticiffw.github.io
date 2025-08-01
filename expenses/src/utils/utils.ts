import { categories, monthNames } from '@utils//constants';
import { logout } from '@context/actions';
import { DataStructure, ItemTotal, TransactionOrIncomeItem } from '@type/types';

const handleErrors = (
  response: Response,
  options: RequestInit,
  dataDispatch: any,
  dispatch: any
) => {
  if (!response.ok) {
    fetch('https://dev-expenses-api.pantheonsite.io/jwt/token', options).then(
      (response) => {
        if (response.status === 403) {
          logout(dispatch, dataDispatch);
        }
      }
    );
    return response.statusText;
  }
  return response.json();
};

export const formatDataForChart = (data: DataStructure, secondSet = false) => {
  const seriesData = [];

  for (const year in data) {
    const yearSeries = {
      name: year,
      data: [],
    };

    for (const month of monthNames) {
      const monthValue = data[year][`${month} ${year}`];
      if (secondSet) {
        // @ts-ignore
        const monthValueSpent = secondSet[year][`${month} ${year}`];
        // @ts-expect-error TBD
        yearSeries.data.push([month, monthValue - monthValueSpent]);
      } else {
        // @ts-expect-error TBD
        yearSeries.data.push([month, monthValue]);
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
  fetch(url, options)
    .then((response) => handleErrors(response, options, dataDispatch, dispatch))
    .then((response) => callback(response))
    .catch((error) => console.log(error));
};

export const deleteNode = (nid: string, token: string, callback: any) => {
  const fetchOptions = {
    method: 'DELETE',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
  fetch(
    `https://dev-expenses-api.pantheonsite.io/node/${nid}?_format=json`,
    fetchOptions
  ).then((response) => {
    callback(response);
  });
};

export const deleteLoan = (nid: string, token: string, dataDispatch: any, dispatch: any, onSuccess: () => void) => {
  const fetchOptions = {
    method: 'DELETE',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
  
  fetchRequest(
    `https://dev-expenses-api.pantheonsite.io/node/${nid}?_format=json`,
    fetchOptions,
    dataDispatch,
    dispatch,
    (data: any) => {
      onSuccess();
    }
  );
};

export const fetchData = (
  token: string,
  dataDispatch: any,
  dispatch: any,
  category: string = '',
  textFilter: string = ''
) => {
  const fetchOptions = {
    method: 'GET',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
  fetchRequest(
    'https://dev-expenses-api.pantheonsite.io/api/expenses',
    fetchOptions,
    dataDispatch,
    dispatch,
    (data: TransactionOrIncomeItem[]) => {
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
          const month = `${monthNames[date.getMonth()]} ${year}`;

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
  const fetchOptions = {
    method: 'GET',
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
  fetchRequest(
    'https://dev-expenses-api.pantheonsite.io/api/loans',
    fetchOptions,
    dataDispatch,
    dispatch,
    async (data) => {
      if (data.length > 0) {
        const paymentPromises = data.map((item) =>
          fetch(
            `https://dev-expenses-api.pantheonsite.io/api/payments/${item.id}`,
            fetchOptions
          )
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
  if (typeof value === 'number') {
    // Handle numbers directly
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } else if (typeof value === 'string') {
    // Parse the string as a number
    const parsedValue = parseFloat(value);
    if (!isNaN(parsedValue)) {
      return parsedValue.toLocaleString('en-US', {
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
  return new Date(date.getFullYear(), date.getMonth(), 1).toLocaleString(
    'default',
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
