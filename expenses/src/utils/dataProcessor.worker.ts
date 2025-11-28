// Web Worker for processing expense data (runs off main thread)
// Note: This worker cannot use imports, so we inline the necessary data

export interface ProcessedData {
  groupedData: Record<string, any[]>;
  totalsPerYearAndMonth: Record<string, Record<string, number>>;
  totalPerYear: Record<string, number>;
  incomeData: any[];
  monthsTotals: Record<string, number>;
  incomeTotals: Record<string, number>;
  totalIncomePerYear: Record<string, number>;
  totalIncomePerYearAndMonth: Record<string, Record<string, number>>;
  categoryTotals: Record<string, { name: string; y: number }>;
  totalSpent: number;
}

// Month names (inline since we can't import)
const monthNames = [
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

// Process expense data in Web Worker
self.onmessage = function (e: MessageEvent) {
  const { data, getCategory } = e.data;

  const groupedData: Record<string, any[]> = {};
  const totalsPerYearAndMonth: Record<string, Record<string, number>> = {};
  const totalPerYear: Record<string, number> = {};
  const incomeData: any[] = [];
  const monthsTotals: Record<string, number> = {};
  const incomeTotals: Record<string, number> = {};
  const totalIncomePerYear: Record<string, number> = {};
  const totalIncomePerYearAndMonth: Record<string, Record<string, number>> = {};
  const categoryTotals: Record<string, { name: string; y: number }> = {};
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
    item: any,
    year: number | string,
    month: string
  ) => {
    const { cat, sum, type } = item;
    if (type === 'incomes') {
      totalIncomePerYear[year] =
        (totalIncomePerYear[year] || 0) + parseFloat(sum);
      totalIncomePerYearAndMonth[year][month] += parseFloat(sum);
      incomeData.push(item);
      incomeTotals[month] = parseFloat(
        ((incomeTotals[month] || 0) + parseFloat(sum)).toFixed(2)
      );
    } else if (type === 'transaction') {
      groupedData[month].push(item);
      monthsTotals[month] = parseFloat(
        ((monthsTotals[month] || 0) + parseFloat(sum)).toFixed(2)
      );
      if (cat && categoryTotals[cat]) {
        categoryTotals[cat].name = getCategory[cat] || '';
        categoryTotals[cat].y = parseFloat(
          (categoryTotals[cat].y + parseFloat(sum)).toFixed(2)
        );
      }
      totalSpent = totalSpent + parseFloat(sum);
      totalsPerYearAndMonth[year][month] += parseFloat(sum);
      totalPerYear[year] = (totalPerYear[year] || 0) + parseFloat(sum);
    }
  };

  if (data) {
    data.forEach((item: any) => {
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

  const processedData: ProcessedData = {
    groupedData,
    totalsPerYearAndMonth,
    totalPerYear,
    incomeData,
    monthsTotals,
    incomeTotals,
    totalIncomePerYear,
    totalIncomePerYearAndMonth,
    categoryTotals,
    totalSpent,
  };

  // Also include totals as alias for monthsTotals for compatibility
  self.postMessage({
    ...processedData,
    totals: monthsTotals,
  });
};
