// Types and interfaces
export interface PaydownInit {
  start_date: string;
  end_date: string;
  principal: number;
  rate: number;
  day_count_method?: 'act/360' | 'act/365';
  recurring?: {
    first_payment_date: string;
    payment_day: number;
  };
  round_values?: boolean;
  debug_logging?: boolean;
  initial_fee?: number;
}

export interface PaydownEvent {
  date: string;
  rate?: number;
  recurring_amount?: number;
  pay_installment?: number;
  pay_single_fee?: number;
  payment_method?: 'equal_installment';
  pay_recurring?: boolean;
  ending?: boolean;
  was_payed?: boolean;
  isSimulatedPayment?: boolean;
  num_days?: number;
}

export interface PaymentLog {
  date: string;
  rate: number | string;
  installment: number | string;
  reduction: number | string;
  interest: number | string;
  principal: number | string;
  fee: number | string;
  was_payed?: boolean | null;
  num_days?: number | null;
}

export interface AnnualSummary {
  total_principal: number;
  total_interest: number;
  total_fees: number;
}

export interface PaydownResult {
  sum_of_interests: number;
  sum_of_reductions: number;
  sum_of_installments: number;
  remaining_principal: number;
  days_calculated: number;
  actual_end_date: string;
  latest_payment_date: string;
  unpaid_interest: number;
  current_interest_due: number;
  interest_paid: number;
  sum_of_fees: number;
  annual_summaries: Record<string, AnnualSummary>;
}

export interface PaydownCalculationResult {
  interests: number;
  reductions: number;
  remaining_principal: number;
  actual_end_date: string;
  latest_payment_date: string;
  final_interest: number;
  fees: number;
  annual_summaries: Record<string, AnnualSummary>;
  current_interest_due: number;
  interest_paid: number;
}

// Utility functions
const zeroFill = (i: number): string => (i < 10 ? '0' : '') + i;

const zeroFillDate = (date: string): string => {
  if (typeof date !== 'string') {
    throw new Error('zeroFillDate illegal parameter type');
  }

  if (!date) {
    return 'N/A';
  }

  const [day, month, year] = splitDate(date);
  return `${zeroFill(Number(day))}.${zeroFill(Number(month))}.${year}`;
};

const splitDate = (date: string): [string, string, string] => {
  const splitted = date.split('.');
  return [splitted[0], splitted[1], splitted[2]];
};

const dateToInteger = (date: string): number => {
  const [day, month, year] = splitDate(date);
  return Number(year + zeroFill(Number(month)) + zeroFill(Number(day)));
};

const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const daysInMonth = (month: number, year: number): number => {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
    return 31;
  } else if ([4, 6, 9, 11].includes(month)) {
    return 30;
  } else if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  } else {
    throw new Error('daysInMonth: invalid month');
  }
};

const calculateDayCount = (
  firstDate: string,
  secondDate: string,
  excludeLastDay = false
): number => {
  const lastDay = excludeLastDay ? 0 : 1;
  const [day1, month1, year1] = splitDate(firstDate);
  const [day2, month2, year2] = splitDate(secondDate);

  const date1 = new Date(Number(year1), Number(month1) - 1, Number(day1));
  const date2 = new Date(Number(year2), Number(month2) - 1, Number(day2));

  // Must round here because of daylight saving time changes
  return (
    Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)) +
    lastDay
  );
};

const getNumberOfMonths = (firstDate: string, secondDate: string): number => {
  const [day1, month1, year1] = splitDate(firstDate);
  const [day2, month2, year2] = splitDate(secondDate);

  const date1 = new Date(Number(year1), Number(month1) - 1, Number(day1));
  const date2 = new Date(Number(year2), Number(month2) - 1, Number(day2));

  return (
    (date2.getFullYear() - date1.getFullYear()) * 12 +
    (date2.getMonth() - date1.getMonth())
  );
};

const checkDateValidity = (date: string): boolean => {
  const result = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!result) return false;

  const day = Number(result[1]);
  const month = Number(result[2]);
  const year = Number(result[3]);

  if (month < 1 || month > 12) return false;

  const lastDayOfMonth = daysInMonth(month, year);
  return day >= 1 && day <= lastDayOfMonth;
};

const isNumeric = (n: any): boolean => {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

const numberIsValid = (n: number): boolean => {
  return !isNaN(n) && typeof n === 'number' && n >= 0;
};

const funcRound = (input: number): number => {
  return Math.round(input * 100) / 100;
};

const eventArraySorter = (a: PaydownEvent, b: PaydownEvent): number => {
  const dateA = dateToInteger(a.date);
  const dateB = dateToInteger(b.date);
  return dateA - dateB;
};

// Date utility class
class Days {
  private day: number;
  private month: number;
  private year: number;

  constructor(initDate?: string) {
    if (initDate) {
      this.setCurrent(initDate);
    }
  }

  getCurrent(): string {
    return `${zeroFill(this.day)}.${zeroFill(this.month)}.${this.year}`;
  }

  setCurrent(current: string): this {
    const [day, month, year] = splitDate(current);
    this.day = Number(day);
    this.month = Number(month);
    this.year = Number(year);
    return this;
  }

  getNext(): string {
    const date = new Date(this.year, this.month - 1, this.day);
    date.setDate(date.getDate() + 1);

    this.day = date.getDate();
    this.month = date.getMonth() + 1;
    this.year = date.getFullYear();

    return `${zeroFill(this.day)}.${zeroFill(this.month)}.${this.year}`;
  }

  getPrev(): string {
    const date = new Date(this.year, this.month - 1, this.day);
    date.setDate(date.getDate() - 1);

    this.day = date.getDate();
    this.month = date.getMonth() + 1;
    this.year = date.getFullYear();

    return `${zeroFill(this.day)}.${zeroFill(this.month)}.${this.year}`;
  }

  getNthMonthNthDay(periodInMonths: number, dayNumber: number): string {
    if (
      periodInMonths === 1 &&
      (dayNumber === 31 || (this.month === 1 && dayNumber > 28))
    ) {
      return this.getNextMonthLastDay();
    }

    let nextMonth = this.month + periodInMonths;
    let year = this.year;

    if (nextMonth > 12) {
      nextMonth = nextMonth - 12;
      year++;
    }

    const actualDay =
      dayNumber === 31 ? daysInMonth(nextMonth, year) : dayNumber;
    this.day = actualDay;
    this.month = nextMonth;
    this.year = year;

    return `${zeroFill(actualDay)}.${zeroFill(nextMonth)}.${year}`;
  }

  private getNextMonthLastDay(): string {
    let nextMonth = this.month;
    let year = this.year;

    if (nextMonth === 12) {
      nextMonth = 1;
      year++;
    } else {
      nextMonth++;
    }

    const lastDay = daysInMonth(nextMonth, year);
    this.day = lastDay;
    this.month = nextMonth;
    this.year = year;

    return `${lastDay}.${zeroFill(nextMonth)}.${year}`;
  }
}

// Main Paydown class
class PaydownCalculator {
  private eventArray: PaydownEvent[] = [];
  private sumOfInterests = 0;
  private sumOfReductions = 0;
  private latestCalculatedInterestDate = '';
  private latestPaymentDate = '';
  private currentRate = '';
  private currentRecurringPayment: number | null = null;
  private currentPrincipal = '';
  private gpiSumOfInterests = 0;
  private totalNumberOfDays = 0;
  private gpiTotalDays = 0;
  private paymentLogArray: PaymentLog[] = [];
  private debugLogArray: string[] = [];
  private dayCountDivisor = 0;
  private latestPeriodEndDate = '';
  private init: Partial<PaydownInit> = {};
  private roundValues = true;
  private initialFee = 0;
  private sumOfFees = 0;
  private currentRecurringFee = 0;
  private currentSingleFee = 0;
  private recurringPaymentPeriod = 1;
  private rateHashMap: Record<string, number> = {};
  private annualSummaries: Record<string, AnnualSummary> = {};
  private paymentLoggingEnabled = false;
  private debugLoggingEnabled = false;
  private debugPrintToConsole = true;

  // Helper to parse date strings into Date objects
  private parseDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
  };

  private round = (input: number): number => {
    if (typeof input !== 'number' || isNaN(input)) {
      throw new Error('round: illegal parameter type');
    }
    return this.roundValues ? funcRound(input) : input;
  };

  private logPayment = (payment: PaymentLog): void => {
    if (this.paymentLoggingEnabled) {
      if (payment.date.length !== 10) {
        payment.date = zeroFillDate(payment.date);
      }
      this.paymentLogArray.push(payment);
    }
  };

  private checkDate = (date: string, context = ''): void => {
    if (!date) {
      throw new Error(`checkDate: ${context} date is missing`);
    }

    if (typeof date !== 'string') {
      throw new Error(
        `checkDate: ${context} date must be of type string: ${date}`
      );
    }

    if (!checkDateValidity(date)) {
      throw new Error(`checkDate: ${context} date is invalid: ${date}`);
    }
  };

  private getPeriodInterests = (
    principal: number,
    rate: number,
    startDate: string,
    endDate: string
  ): number => {
    let sumOfInterests = 0;

    if (!principal) {
      throw new Error('getPeriodInterests: invalid parameter: principal');
    }
    if (!startDate) {
      throw new Error('getPeriodInterests: invalid parameter: startDate');
    }
    if (!endDate) {
      throw new Error('getPeriodInterests: invalid parameter: endDate');
    }

    if (dateToInteger(startDate) > dateToInteger(endDate)) {
      throw new Error(
        `getPeriodInterests: invalid date: startDate ${startDate} is after endDate ${endDate}`
      );
    }

    if (this.latestPeriodEndDate) {
      const dateDifference = calculateDayCount(
        this.latestPeriodEndDate,
        startDate,
        true
      );
      if (dateDifference !== 1) {
        throw new Error(
          `Date difference is not one day as expected, latestPeriodEndDate: ${this.latestPeriodEndDate} startDate: ${startDate}`
        );
      }
    }

    const totalNumberOfDays = calculateDayCount(startDate, endDate);
    this.totalNumberOfDays += totalNumberOfDays;

    if (this.debugLoggingEnabled) {
      this.debugLogPeriodStart(startDate, totalNumberOfDays, principal, rate);
    }

    if (this.rateHashMap.hasOwnProperty(dateToInteger(startDate))) {
      rate = this.rateHashMap[dateToInteger(startDate)];
      this.logPayment({
        date: startDate,
        rate,
        installment: '-',
        reduction: '-',
        interest: '-',
        principal: this.round(principal),
        fee: '-',
      });
    }

    if (this.debugLoggingEnabled) {
      this.debugLog(`Interest rate: ${rate}`);
    }

    // Check if interest rate changes during period
    let rateEvent = this.getFirstEventAfterDate('rate', startDate, endDate);

    if (rateEvent) {
      let subperiodStartDate = startDate;
      let rateEventDate = rateEvent.date;
      let currentRate = rate;
      let numberOfDays: number, factor: number, subperiodInterest: number;

      while (rateEvent) {
        numberOfDays = calculateDayCount(
          subperiodStartDate,
          rateEventDate,
          true
        );
        this.gpiTotalDays += numberOfDays;
        factor = numberOfDays / this.dayCountDivisor;
        subperiodInterest = principal * (currentRate / 100) * factor;

        if (this.debugLoggingEnabled) {
          this.debugLogSubperiod(
            numberOfDays,
            subperiodInterest,
            rateEvent.date,
            rateEvent.rate
          );
        }

        sumOfInterests += subperiodInterest;
        currentRate = rateEvent.rate;

        this.logPayment({
          date: rateEvent.date,
          rate: rateEvent.rate,
          installment: '-',
          reduction: '-',
          interest: '-',
          principal: this.round(principal),
          fee: '-',
        });

        const nextRateEvent = this.getFirstEventAfterDate(
          'rate',
          rateEventDate,
          endDate
        );
        subperiodStartDate = rateEventDate;
        if (nextRateEvent) {
          rateEventDate = nextRateEvent.date;
        }
        rateEvent = nextRateEvent;
      }

      numberOfDays = calculateDayCount(rateEventDate, endDate);
      this.gpiTotalDays += numberOfDays;
      factor = numberOfDays / this.dayCountDivisor;
      subperiodInterest = principal * (currentRate / 100) * factor;

      if (this.debugLoggingEnabled) {
        this.debugLogSubperiod(numberOfDays, subperiodInterest);
      }

      sumOfInterests += subperiodInterest;
      this.currentRate = currentRate;
    } else {
      let numberOfDays = calculateDayCount(startDate, endDate);
      this.gpiTotalDays += numberOfDays;
      let factor = numberOfDays / this.dayCountDivisor;
      let subperiodInterest = principal * (rate / 100) * factor;

      if (this.debugLoggingEnabled) {
        this.debugLog(
          `Period daily interest: ${subperiodInterest / numberOfDays}`
        );
      }

      sumOfInterests += subperiodInterest;
      this.currentRate = rate;
    }

    if (this.debugLoggingEnabled) {
      this.debugLog('Period total interest: ', sumOfInterests);
    }

    this.gpiSumOfInterests += sumOfInterests;
    this.latestPeriodEndDate = endDate;

    return sumOfInterests;
  };

  private getFirstEventAfterDate = (
    property: keyof PaydownEvent,
    date: string,
    boundaryDate: string
  ): PaydownEvent | false => {
    for (const event of this.eventArray) {
      const eventDate = dateToInteger(event.date);
      const targetDate = dateToInteger(date);
      const boundaryDateInt = dateToInteger(boundaryDate);

      if (
        eventDate > targetDate &&
        event.hasOwnProperty(property) &&
        eventDate <= boundaryDateInt
      ) {
        return event;
      }
      if (eventDate > boundaryDateInt) {
        return false;
      }
    }
    return false;
  };

  // Get the last rate event on or before a given date
  private getLastRateEventOnOrBeforeDate = (
    date: string
  ): PaydownEvent | null => {
    const targetDateInt = dateToInteger(date);
    let lastEvent: PaydownEvent | null = null;
    let lastEventDate = 0;

    for (const event of this.eventArray) {
      const eventDate = dateToInteger(event.date);
      if (
        event.hasOwnProperty('rate') &&
        eventDate <= targetDateInt &&
        eventDate > lastEventDate
      ) {
        lastEvent = event;
        lastEventDate = eventDate;
      }
    }

    return lastEvent;
  };

  private handleLastPayment = (
    reduction: number,
    date: string,
    periodInterest: number,
    fee = 0,
    numDays?: number
  ): void => {
    let installment: number;
    reduction += this.currentPrincipal;

    installment = this.round(reduction + periodInterest);
    this.sumOfReductions += reduction;

    // Add to annual summaries for the last payment
    const year = date.split('.')[2];
    if (!this.annualSummaries[year]) {
      this.annualSummaries[year] = {
        total_principal: 0,
        total_interest: 0,
        total_fees: 0,
      };
    }
    this.annualSummaries[year].total_principal += reduction;
    this.annualSummaries[year].total_interest += periodInterest;
    this.annualSummaries[year].total_fees += fee;

    this.logPayment({
      date,
      rate: this.currentRate,
      installment,
      reduction: this.round(reduction),
      interest: this.round(periodInterest),
      principal: 0,
      fee: this.round(fee),
      num_days: numDays || null,
    });

    this.currentPrincipal = 0;
    this.latestPaymentDate = date;
  };

  private funcPayInstallment = (
    index: number,
    dateObj: Days,
    installment: number,
    fee = 0
  ): boolean => {
    let periodInterest: number;
    let reduction: number;
    let startDate: string, endDate: string;

    if (this.latestCalculatedInterestDate === this.eventArray[index].date) {
      periodInterest = 0;
    } else {
      startDate = dateObj
        .setCurrent(this.latestCalculatedInterestDate)
        .getNext();
      endDate = this.eventArray[index].date;
      periodInterest = this.getPeriodInterests(
        this.currentPrincipal,
        this.currentRate,
        startDate,
        endDate
      );
    }

    if (installment === 0) {
      reduction = 0;
    } else {
      reduction = installment - periodInterest;
    }

    if (reduction < 0) {
      throw new Error(
        `Exception: installment ${this.round(installment)} is too small to cover the interest ${this.round(periodInterest)}: ${startDate} - ${endDate}`
      );
    }

    this.sumOfInterests += periodInterest;
    this.currentPrincipal -= reduction;
    this.latestCalculatedInterestDate = this.eventArray[index].date;
    this.latestPaymentDate = this.eventArray[index].date;

    const numDays = calculateDayCount(startDate, endDate, false);

    if (this.currentPrincipal <= 0) {
      this.handleLastPayment(
        reduction,
        this.eventArray[index].date,
        periodInterest,
        fee,
        numDays
      );
      return false;
    }

    // Add to annual summaries
    const year = this.eventArray[index].date.split('.')[2];
    if (!this.annualSummaries[year]) {
      this.annualSummaries[year] = {
        total_principal: 0,
        total_interest: 0,
        total_fees: 0,
      };
    }
    this.annualSummaries[year].total_principal += reduction;
    this.annualSummaries[year].total_interest += periodInterest;
    this.annualSummaries[year].total_fees += fee;

    this.sumOfReductions += reduction;

    this.logPayment({
      date: this.eventArray[index].date,
      rate: this.currentRate,
      installment: this.round(reduction + periodInterest),
      reduction: this.round(reduction),
      interest: this.round(periodInterest),
      principal: this.round(this.currentPrincipal),
      fee: this.round(fee),
      was_payed: this.eventArray[index].was_payed,
      num_days: numDays,
    });

    return true;
  };

  private calculateRecurringAmount = (data: PaydownInit): number => {
    const months = getNumberOfMonths(data.start_date, data.end_date);
    const monthlyRate = data.rate / 12 / 100;
    const monthlyPayment =
      (data.principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    return monthlyPayment + 1;
  };

  private setInit = (data: PaydownInit): void => {
    if (!(typeof data === 'object' && data !== null)) {
      throw new Error('setInit: invalid or missing init_obj');
    }

    this.init.start_date = data.start_date;
    this.init.end_date = data.end_date;
    this.init.principal = data.principal;
    this.init.rate = data.rate;

    this.init.day_count_method = data.day_count_method || 'act/360';

    if (data.recurring) {
      this.currentRecurringPayment = this.calculateRecurringAmount(data);

      if (!data.recurring.first_payment_date) {
        throw new Error('setInit: missing first recurring payment date');
      }
      this.init.first_payment_date = data.recurring.first_payment_date;

      if (
        !numberIsValid(data.recurring.payment_day) ||
        data.recurring.payment_day < 1 ||
        data.recurring.payment_day > 31 ||
        !Number.isInteger(data.recurring.payment_day)
      ) {
        throw new Error('setInit: invalid or missing first payment_day number');
      }
      this.init.payment_day = data.recurring.payment_day;
      this.init.payment_method = 'equal_installment';
    } else {
      this.currentRecurringPayment = null;
    }

    this.roundValues =
      data.round_values !== undefined ? data.round_values : true;
    this.debugLoggingEnabled = data.debug_logging || false;
    this.initialFee = data.initial_fee || 0;
  };

  private checkAndAddEvent = (event: PaydownEvent): void => {
    if (!event.hasOwnProperty('date')) {
      throw new Error('checkAndAddEvent: date missing from event');
    }

    this.checkDate(event.date, 'event');

    if (event.hasOwnProperty('rate')) {
      if (isNaN(event.rate!) || typeof event.rate !== 'number') {
        throw new Error(
          `checkAndAddEvent: invalid rate in event ${event.date}`
        );
      }
    }

    if (event.hasOwnProperty('recurring_amount')) {
      if (!numberIsValid(event.recurring_amount!)) {
        throw new Error(
          `checkAndAddEvent: invalid recurring_amount in event ${event.date}`
        );
      }
    }

    if (event.hasOwnProperty('pay_installment')) {
      if (
        typeof event.pay_installment !== 'number' ||
        event.pay_installment <= 0 ||
        isNaN(event.pay_installment)
      ) {
        throw new Error(
          `checkAndAddEvent: invalid pay_installment in event ${event.date}`
        );
      } else {
        event.was_payed = true;
        event.pay_recurring = true;
      }
    }

    if (event.hasOwnProperty('pay_single_fee')) {
      if (!numberIsValid(event.pay_single_fee!)) {
        throw new Error(
          `checkAndAddEvent: invalid pay_single_fee in event ${event.date}`
        );
      }
    }

    this.eventArray.push({ ...event });
  };

  private moveToNextMondayIfWeekend = (date: Date): string => {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday

    if (day === 6) {
      date.setDate(date.getDate() + 2); // Saturday → Monday
    } else if (day === 0) {
      date.setDate(date.getDate() + 1); // Sunday → Monday
    }

    return `${zeroFill(date.getDate())}.${zeroFill(date.getMonth() + 1)}.${date.getFullYear()}`;
  };

  private addEvent = (event: PaydownEvent): void => {
    if (!event.hasOwnProperty('date')) {
      throw new Error('addEvent: date missing from event');
    }

    const date = this.parseDate(event.date);
    event.date = this.moveToNextMondayIfWeekend(date);
    this.eventArray.push({ ...event });
  };

  private mergeEvents = (): void => {
    this.eventArray.sort(eventArraySorter);

    for (let index = 0; index < this.eventArray.length - 1; index++) {
      if (this.eventArray[index].hasOwnProperty('rate')) {
        this.rateHashMap[dateToInteger(this.eventArray[index].date)] =
          this.eventArray[index].rate!;
      }

      if (
        dateToInteger(this.eventArray[index].date) ===
        dateToInteger(this.eventArray[index + 1].date)
      ) {
        Object.assign(this.eventArray[index], this.eventArray[index + 1]);
        this.eventArray.splice(index + 1, 1);
        index--;
      }
    }
  };

  private checkFirstPaymentDate = (): void => {
    this.checkDate(this.init.first_payment_date!, '1st recurring payment');
    if (
      dateToInteger(this.init.first_payment_date!) <=
      dateToInteger(this.init.start_date!)
    ) {
      throw new Error(
        'checkFirstPaymentDate: first payment date must be after start date'
      );
    }
  };

  private generatePaymentEventsTill = (
    date: string,
    lastPaymentDate?: string
  ): void => {
    const dateObj = new Days(this.init.first_payment_date!);

    const addEventIfValid = (eventDate: string): void => {
      const eventDateInt = dateToInteger(eventDate);
      const lastPaymentDateInt = lastPaymentDate
        ? dateToInteger(lastPaymentDate)
        : null;

      if (!lastPaymentDate || eventDateInt > lastPaymentDateInt!) {
        this.addEvent({ date: eventDate, pay_recurring: true });
      }
    };

    addEventIfValid(dateObj.getCurrent());

    while (
      dateToInteger(
        dateObj.getNthMonthNthDay(
          this.recurringPaymentPeriod,
          this.init.payment_day!
        )
      ) <= dateToInteger(date)
    ) {
      const nextPaymentDate = dateObj.getCurrent();
      addEventIfValid(nextPaymentDate);
    }
  };

  private checkEvents = (): void => {
    for (const event of this.eventArray) {
      if (dateToInteger(event.date) <= dateToInteger(this.init.start_date!)) {
        throw new Error(
          `checkEvents: event date (${event.date}) before start date not allowed`
        );
      }
    }
  };

  private debugLogPeriodStart = (
    startDate: string,
    totalNumberOfDays: number,
    principal: number,
    rate: number
  ): void => {
    this.debugWrite(`New period starts ${startDate}`);
    this.debugWrite(`Days in period: ${totalNumberOfDays}`);
    this.debugWrite(`Remaining principal: ${this.round(principal)}`);
  };

  private debugLogSubperiod = (
    numberOfDays: number,
    subperiodInterest: number,
    rateEventDate?: string,
    newRate?: number
  ): void => {
    this.debugWrite(`Subperiod days: ${numberOfDays}`);
    this.debugWrite(
      `Subperiod daily interest: ${this.round(subperiodInterest / numberOfDays)}`
    );
    this.debugWrite(
      `Subperiod total interest: ${this.round(subperiodInterest)}`
    );
    if (rateEventDate) {
      this.debugWrite(`Rate changes ${rateEventDate}, new rate is ${newRate}`);
    }
  };

  private debugLog = (string: string, number?: number): void => {
    if (!isNumeric(number)) {
      this.debugWrite(string);
    } else {
      this.debugWrite(string, this.round(number!));
    }
  };

  private debugWrite = (string: string, number: number | string = ''): void => {
    if (this.debugPrintToConsole) {
      if (process.env.NODE_ENV === 'development') {
        console.log(string, number);
      }
    } else {
      this.debugLogArray.push(string + number);
    }
  };

  public calculateToDate = (
    arrayOfEvents?: PaymentLog[],
    arrayOfDebugPrints?: string[],
    lastPaymentDate?: string
  ): PaydownCalculationResult => {
    let installment: number;
    let finalInterest = 0;

    if (
      typeof this.init.principal !== 'number' ||
      isNaN(this.init.principal!)
    ) {
      throw new Error('calculateToDate: principal must be number');
    }
    if (this.init.principal === 0) {
      throw new Error('calculateToDate: principal is missing');
    }
    if (typeof this.init.rate !== 'number' || isNaN(this.init.rate!)) {
      throw new Error('calculateToDate: rate must be number');
    }

    this.paymentLoggingEnabled = Array.isArray(arrayOfEvents);
    this.debugPrintToConsole = !Array.isArray(arrayOfDebugPrints);

    this.sumOfInterests = 0;
    this.sumOfReductions = 0;
    this.gpiSumOfInterests = 0;
    this.annualSummaries = {};

    const dateObj = new Days();

    this.checkDate(this.init.start_date!, 'start');
    this.checkDate(this.init.end_date!, 'end');

    if (this.currentRecurringPayment !== null) {
      this.checkFirstPaymentDate();
      this.generatePaymentEventsTill(this.init.end_date!, lastPaymentDate);
    }

    this.addEvent({ date: this.init.end_date!, ending: true });
    this.mergeEvents();
    this.checkEvents();

    if (this.init.day_count_method === 'act/360') {
      this.dayCountDivisor = 360;
    } else if (this.init.day_count_method === 'act/365') {
      this.dayCountDivisor = 365;
    } else {
      throw new Error(
        `invalid day count method: ${this.init.day_count_method}`
      );
    }

    this.latestCalculatedInterestDate = dateObj
      .setCurrent(this.init.start_date!)
      .getPrev();
    this.latestPeriodEndDate = this.latestCalculatedInterestDate;
    this.totalNumberOfDays = 0;
    this.gpiTotalDays = 0;

    this.logPayment({
      date: this.init.start_date!,
      rate: this.init.rate!,
      installment: '-',
      reduction: '-',
      interest: '-',
      principal: this.init.principal!,
      fee: this.initialFee,
    });

    const startYear = this.init.start_date!.split('.')[2];
    if (!this.annualSummaries[startYear]) {
      this.annualSummaries[startYear] = {
        total_principal: 0,
        total_interest: 0,
        total_fees: 0,
      };
    }
    this.annualSummaries[startYear].total_fees += this.initialFee;

    this.currentPrincipal = this.init.principal!;
    this.currentRate = this.init.rate!;
    this.sumOfFees = this.initialFee;

    for (let index = 0; index < this.eventArray.length; index++) {
      const event = this.eventArray[index];

      if (event.hasOwnProperty('recurring_amount')) {
        if (this.currentRecurringPayment === null) {
          throw new Error(
            "Can't do recurring_amount: initial recurring data missing or invalid!"
          );
        }
        this.currentRecurringPayment = event.recurring_amount!;
      }

      if (event.hasOwnProperty('pay_single_fee')) {
        this.sumOfFees += event.pay_single_fee!;
        this.currentSingleFee = event.pay_single_fee!;

        const feeYear = event.date.split('.')[2];
        if (!this.annualSummaries[feeYear]) {
          this.annualSummaries[feeYear] = {
            total_principal: 0,
            total_interest: 0,
            total_fees: 0,
          };
        }
        this.annualSummaries[feeYear].total_fees += event.pay_single_fee!;
      } else {
        this.currentSingleFee = 0;
      }

      if (event.hasOwnProperty('payment_method')) {
        if (event.payment_method === 'equal_installment') {
          this.init.payment_method = 'equal_installment';
        } else {
          throw new Error(
            `invalid payment method in event: ${event.payment_method}`
          );
        }
      }

      if (event.hasOwnProperty('pay_recurring')) {
        if (this.currentRecurringPayment === null) {
          throw new Error(
            "Can't do pay_recurring: initial recurring data missing or invalid!"
          );
        }
        this.sumOfFees += this.currentRecurringFee;

        if (this.init.payment_method === 'equal_installment') {
          installment = event.hasOwnProperty('pay_installment')
            ? event.pay_installment!
            : this.currentRecurringPayment;
          if (
            !this.funcPayInstallment(
              index,
              dateObj,
              installment,
              this.currentRecurringFee
            )
          ) {
            break;
          }
        } else {
          throw new Error(
            `invalid payment method: ${this.init.payment_method}`
          );
        }
      }

      if (this.currentSingleFee) {
        if (!event.hasOwnProperty('ending')) {
          this.logPayment({
            date: event.date,
            rate: this.currentRate,
            installment: '-',
            reduction: '-',
            interest: '-',
            principal: this.round(this.currentPrincipal),
            fee: this.round(this.currentSingleFee),
          });
          this.currentSingleFee = 0;
        }
      }

      if (event.hasOwnProperty('ending')) {
        if (
          !event.hasOwnProperty('pay_recurring') &&
          !event.hasOwnProperty('pay_installment')
        ) {
          finalInterest = this.getPeriodInterests(
            this.currentPrincipal,
            this.currentRate,
            dateObj.setCurrent(this.latestCalculatedInterestDate).getNext(),
            event.date
          );
          this.sumOfInterests += finalInterest;
          const numDays = calculateDayCount(
            dateObj.setCurrent(this.latestCalculatedInterestDate).getNext(),
            event.date
          );

          const endingYear = event.date.split('.')[2];
          if (!this.annualSummaries[endingYear]) {
            this.annualSummaries[endingYear] = {
              total_principal: 0,
              total_interest: 0,
              total_fees: 0,
            };
          }
          this.annualSummaries[endingYear].total_interest += finalInterest;
          this.annualSummaries[endingYear].total_principal +=
            this.currentPrincipal;

          this.logPayment({
            date: event.date,
            rate: this.currentRate,
            installment: '-',
            reduction: '-',
            interest: this.round(finalInterest),
            principal: this.round(this.currentPrincipal),
            fee: this.round(this.currentSingleFee),
            num_days: numDays,
          });
          this.latestCalculatedInterestDate = this.init.end_date!;
        } else {
          this.latestCalculatedInterestDate = this.latestPaymentDate;
        }
        break;
      }
    }

    if (
      this.round(this.gpiSumOfInterests) !== this.round(this.sumOfInterests)
    ) {
      throw new Error(
        `Sum of interests mismatch: ${this.round(this.gpiSumOfInterests)} vs. ${this.round(this.sumOfInterests)}`
      );
    }

    if (this.gpiTotalDays !== this.totalNumberOfDays) {
      throw new Error(
        `Day count mismatch, gpiTotalDays: ${this.gpiTotalDays} totalNumberOfDays: ${this.totalNumberOfDays}`
      );
    }

    if (this.paymentLoggingEnabled && arrayOfEvents) {
      arrayOfEvents.push(...this.paymentLogArray);
    }

    if (
      this.debugLoggingEnabled &&
      !this.debugPrintToConsole &&
      arrayOfDebugPrints
    ) {
      arrayOfDebugPrints.push(...this.debugLogArray);
    }

    // Calculate interest paid from actual payments only (was_payed === true)
    let interestPaid = 0;
    if (this.paymentLogArray && this.paymentLogArray.length > 0) {
      this.paymentLogArray.forEach((payment: PaymentLog) => {
        if (
          payment.was_payed === true &&
          payment.interest !== undefined &&
          payment.interest !== null &&
          payment.interest !== '-'
        ) {
          const interestValue =
            typeof payment.interest === 'string'
              ? parseFloat(payment.interest) || 0
              : payment.interest || 0;
          interestPaid += interestValue;
        }
      });
    }

    // Round if needed
    if (this.roundValues) {
      interestPaid = funcRound(interestPaid);
    }

    return [
      this.sumOfInterests,
      this.sumOfReductions,
      this.currentPrincipal,
      this.latestCalculatedInterestDate,
      this.latestPaymentDate,
      finalInterest,
      this.sumOfFees,
      this.annualSummaries,
      interestPaid,
    ] as PaydownCalculationResult;
  };
}

// Main export function
export default function Paydown() {
  return {
    calculate: function (
      initObj: PaydownInit,
      eventsArray?: PaydownEvent[],
      paymentsArray?: PaymentLog[],
      debugArray?: string[]
    ): PaydownResult {
      const paydown = new PaydownCalculator();

      paydown.setInit(initObj);

      let localArray: PaydownEvent[] = [];
      let lastPaymentDate: string | undefined;

      if (eventsArray) {
        const filteredEvents = eventsArray.filter(
          (event) =>
            event.pay_installment !== undefined && !event.isSimulatedPayment
        );
        const sortedByDate = filteredEvents.sort(
          (a, b) =>
            paydown.parseDate(b.date).getTime() -
            paydown.parseDate(a.date).getTime()
        );
        const lastEventByDate = sortedByDate[0];
        lastPaymentDate = lastEventByDate ? lastEventByDate.date : undefined;
        localArray = eventsArray.slice();
      }

      while (localArray[0]) {
        paydown.checkAndAddEvent(localArray.shift()!);
      }

      let interests: number,
        reductions: number,
        remainingPrincipal: number,
        actualEndDate: string,
        latestPaymentDate: string,
        finalInterest: number,
        fees: number,
        annualSummaries: Record<string, AnnualSummary>,
        interestPaid: number;

      try {
        [
          interests,
          reductions,
          remainingPrincipal,
          actualEndDate,
          latestPaymentDate,
          finalInterest,
          fees,
          annualSummaries,
          interestPaid,
        ] = paydown.calculateToDate(paymentsArray, debugArray, lastPaymentDate);
      } catch (err) {
        throw err;
      }

      let sumOfInstallments: number;

      if (initObj.hasOwnProperty('round_values')) {
        if (initObj.round_values) {
          sumOfInstallments = funcRound(interests + reductions - finalInterest);
          interests = funcRound(interests);
          reductions = funcRound(reductions);
          remainingPrincipal = funcRound(remainingPrincipal);
          finalInterest = funcRound(finalInterest);
          fees = funcRound(fees);
          interestPaid = funcRound(interestPaid);

          for (const year in annualSummaries) {
            annualSummaries[year].total_principal = funcRound(
              annualSummaries[year].total_principal
            );
            annualSummaries[year].total_interest = funcRound(
              annualSummaries[year].total_interest
            );
            annualSummaries[year].total_fees = funcRound(
              annualSummaries[year].total_fees
            );
          }
        } else {
          sumOfInstallments = interests + reductions - finalInterest;
        }
      } else {
        sumOfInstallments = funcRound(interests + reductions - finalInterest);
        interests = funcRound(interests);
        reductions = funcRound(reductions);
        remainingPrincipal = funcRound(remainingPrincipal);
        finalInterest = funcRound(finalInterest);
        fees = funcRound(fees);
        interestPaid = funcRound(interestPaid);

        for (const year in annualSummaries) {
          annualSummaries[year].total_principal = funcRound(
            annualSummaries[year].total_principal
          );
          annualSummaries[year].total_interest = funcRound(
            annualSummaries[year].total_interest
          );
          annualSummaries[year].total_fees = funcRound(
            annualSummaries[year].total_fees
          );
        }
      }

      return {
        sum_of_interests: interests,
        sum_of_reductions: reductions,
        sum_of_installments: sumOfInstallments,
        remaining_principal: remainingPrincipal,
        days_calculated: paydown.totalNumberOfDays,
        actual_end_date: zeroFillDate(actualEndDate),
        latest_payment_date: zeroFillDate(latestPaymentDate),
        unpaid_interest: finalInterest,
        interest_paid: interestPaid,
        sum_of_fees: fees,
        annual_summaries: annualSummaries,
      };
    },
  };
}
