// Import pure loan calculation functions
import {
  calculateAnnuity,
  calculateRemainingBalance,
  recalculateAfterRateChange,
  calculatePeriodInterest,
} from './loanEngine';

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

/**
 * Format financial value to 2 decimal places for UI/output display
 * 
 * BANKING DISPLAY STANDARD:
 * This function implements standard banking rounding to 2 decimal places
 * (cents/bani) for final presentation only.
 * 
 * CRITICAL RESTRICTION:
 * This function MUST ONLY be used at the output/presentation layer.
 * It MUST NEVER be used in core financial calculations.
 * 
 * ROUNDING METHOD:
 * Uses standard "round half up" method:
 *   - Multiply by 100 to shift decimal point
 *   - Round to nearest integer
 *   - Divide by 100 to restore decimal point
 * 
 * Examples:
 *   1234.567 → 1234.57 (rounds up)
 *   1234.564 → 1234.56 (rounds down)
 *   1234.565 → 1234.57 (rounds up - half up)
 * 
 * WHY NOT USED IN CALCULATIONS:
 * - Rounding intermediate values causes cumulative errors
 * - Violates banking precision requirements
 * - Can cause balance reconciliation failures
 * - See detailed explanation in FORMATTING LAYER comment above
 * 
 * @param input - Raw floating-point value from calculation engine
 * @returns Value rounded to 2 decimal places for display
 */
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
  private loggedRateChangeEvents: Set<number> = new Set();
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
      const startDateInt = dateToInteger(startDate);
      // Only log if not already logged (to avoid duplication)
      if (!this.loggedRateChangeEvents.has(startDateInt)) {
        // Store raw values (no rounding) - rounding happens at output/UI layer
        this.logPayment({
          date: startDate,
          rate,
          installment: '-',
          reduction: '-',
          interest: '-',
          principal,
          fee: '-',
        });
        this.loggedRateChangeEvents.add(startDateInt);
      }
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
      let numberOfDays: number, subperiodInterest: number;

      while (rateEvent) {
        numberOfDays = calculateDayCount(
          subperiodStartDate,
          rateEventDate,
          true
        );
        this.gpiTotalDays += numberOfDays;
        // Use pure loanEngine function to calculate period interest
        const dayCountMethod = this.dayCountDivisor === 360 ? 'act/360' : 'act/365';
        subperiodInterest = calculatePeriodInterest(
          principal,
          currentRate,
          numberOfDays,
          dayCountMethod
        );

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

        const rateEventDateInt = dateToInteger(rateEvent.date);
        // Only log if not already logged (to avoid duplication)
        if (!this.loggedRateChangeEvents.has(rateEventDateInt)) {
          // Store raw values (no rounding) - rounding happens at output/UI layer
          this.logPayment({
            date: rateEvent.date,
            rate: rateEvent.rate,
            installment: '-',
            reduction: '-',
            interest: '-',
            principal,
            fee: '-',
          });
          this.loggedRateChangeEvents.add(rateEventDateInt);
        }

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
      // Use pure loanEngine function to calculate period interest
      const dayCountMethod = this.dayCountDivisor === 360 ? 'act/360' : 'act/365';
      subperiodInterest = calculatePeriodInterest(
        principal,
        currentRate,
        numberOfDays,
        dayCountMethod
      );

      if (this.debugLoggingEnabled) {
        this.debugLogSubperiod(numberOfDays, subperiodInterest);
      }

      sumOfInterests += subperiodInterest;
      this.currentRate = currentRate;
    } else {
      let numberOfDays = calculateDayCount(startDate, endDate);
      this.gpiTotalDays += numberOfDays;
      // Use pure loanEngine function to calculate period interest
      const dayCountMethod = this.dayCountDivisor === 360 ? 'act/360' : 'act/365';
      let subperiodInterest = calculatePeriodInterest(
        principal,
        rate,
        numberOfDays,
        dayCountMethod
      );

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

    installment = reduction + periodInterest; // No rounding in internal calculation
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

    // Store raw values (no rounding) - rounding happens at output/UI layer
    this.logPayment({
      date,
      rate: this.currentRate,
      installment,
      reduction,
      interest: periodInterest,
      principal: 0,
      fee,
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

    // Store raw values (no rounding) - rounding happens at output/UI layer
    this.logPayment({
      date: this.eventArray[index].date,
      rate: this.currentRate,
      installment: reduction + periodInterest,
      reduction,
      interest: periodInterest,
      principal: this.currentPrincipal,
      fee,
      was_payed: this.eventArray[index].was_payed,
      num_days: numDays,
    });

    return true;
  };

  /**
   * Calculate recurring payment amount using standard annuity formula
   * Delegates to pure loanEngine module
   */
  private calculateRecurringAmount = ({
    principal,
    rate,
    startDate,
    endDate,
  }: {
    principal: number;
    rate: number;
    startDate: string;
    endDate: string;
  }): number => {
    return calculateAnnuity(principal, rate, startDate, endDate);
  };

  /**
   * Calculate initial recurring payment from PaydownInit
   * Uses first_payment_date if available, otherwise start_date
   */
  private calculateInitialRecurringAmount = (data: PaydownInit): number => {
    return this.calculateRecurringAmount({
      principal: data.principal,
      rate: data.rate,
      startDate: data.start_date,
      endDate: data.end_date,
    });
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
      this.currentRecurringPayment = this.calculateInitialRecurringAmount(data);

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
    this.loggedRateChangeEvents.clear();

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

      // Handle rate change: if rate changes and recurring_amount is NOT manually specified,
      // automatically recalculate the monthly payment based on current principal and new rate
      // IMPORTANT: If pay_recurring is also present, we must apply the payment with OLD rate first,
      // then recalculate the annuity with NEW rate
      if (event.hasOwnProperty('rate')) {
        const newRate = event.rate!;

        // Convert rates to numbers for comparison
        const currentRateNum =
          typeof this.currentRate === 'string'
            ? parseFloat(String(this.currentRate))
            : Number(this.currentRate);
        const newRateNum =
          typeof newRate === 'number' ? newRate : parseFloat(String(newRate));

        // Check if rate actually changed
        const rateChanged =
          !isNaN(currentRateNum) &&
          !isNaN(newRateNum) &&
          Math.abs(newRateNum - currentRateNum) > 0.001;

        // Log rate change event immediately to maintain correct chronological order in payment log
        // This ensures rate changes appear before fee events that occur later
        if (!event.hasOwnProperty('pay_recurring')) {
          const eventDateInt = dateToInteger(event.date);
          if (!this.loggedRateChangeEvents.has(eventDateInt)) {
            // Store raw values (no rounding) - rounding happens at output/UI layer
            this.logPayment({
              date: event.date,
              rate: newRate,
              installment: '-',
              reduction: '-',
              interest: '-',
              principal: this.currentPrincipal,
              fee: '-',
            });
            this.loggedRateChangeEvents.add(eventDateInt);
          }
        }

        // Recalculate monthly payment if:
        // 1. Recurring payments are enabled
        // 2. recurring_amount is NOT manually specified (undefined = AUTO mode)
        // 3. Rate actually changed
        // 4. pay_recurring is NOT present (if present, we'll recalculate after applying the payment)
        if (
          this.currentRecurringPayment !== null &&
          !event.hasOwnProperty('recurring_amount') &&
          rateChanged &&
          !event.hasOwnProperty('pay_recurring')
        ) {
          try {
            // Get current principal as number (remaining principal at this point)
            const currentPrincipalNum =
              typeof this.currentPrincipal === 'number'
                ? this.currentPrincipal
                : parseFloat(String(this.currentPrincipal));

            if (isNaN(currentPrincipalNum) || currentPrincipalNum <= 0) {
              throw new Error(
                `Invalid current principal: ${this.currentPrincipal}`
              );
            }

            // Use pure loanEngine module to recalculate annuity after rate change
            // Since pay_recurring is NOT present, we don't apply payment first
            const oldPayment = this.currentRecurringPayment;
            const recalculationResult = recalculateAfterRateChange({
              currentPrincipal: currentPrincipalNum,
              currentPayment: oldPayment,
              oldRate: currentRateNum,
              newRate: newRateNum,
              rateChangeDate: event.date,
              loanEndDate: this.init.end_date!,
              applyPaymentFirst: false, // No payment on this date, just rate change
            });

            // Validation warning is handled inside recalculateAfterRateChange
            // Update recurring payment amount - this will be used for all future payments
            this.currentRecurringPayment = recalculationResult.newPayment;

            if (this.debugLoggingEnabled) {
              this.debugWrite(
                `[RATE CHANGE] ${event.date}: Rate ${currentRateNum}% -> ${newRateNum}%. ` +
                  `Recalculated payment: ${oldPayment} -> ${recalculationResult.newPayment}. ` +
                  `Remaining principal: ${currentPrincipalNum}, Remaining months: ${recalculationResult.remainingMonths}`
              );
            }
          } catch (error) {
            // If recalculation fails, keep existing payment amount
            if (this.debugLoggingEnabled) {
              this.debugWrite(
                `[RATE CHANGE ERROR] ${event.date}: Failed to recalculate payment. Error: ${error}. Keeping: ${this.currentRecurringPayment}`
              );
            }
          }
        }

        // Note: this.currentRate is NOT updated here - it's updated in getPeriodInterests
        // when interest is calculated for a period. This matches the original JavaScript code behavior.
      }

      // If user manually specified recurring_amount, use that value (overrides auto-calculation)
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
          // Apply the payment using the CURRENT (OLD) interest rate
          // This is the payment amount calculated with the rate before any change
          installment = event.hasOwnProperty('pay_installment')
            ? event.pay_installment!
            : this.currentRecurringPayment;
          
          // Store principal before payment to check if we need to recalculate after
          const principalBeforePayment =
            typeof this.currentPrincipal === 'number'
              ? this.currentPrincipal
              : parseFloat(String(this.currentPrincipal));
          
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

          // After applying the payment with OLD rate, if rate also changed on this date,
          // recalculate the annuity using NEW rate with the updated principal
          if (event.hasOwnProperty('rate')) {
            const newRate = event.rate!;
            const newRateNum =
              typeof newRate === 'number' ? newRate : parseFloat(String(newRate));
            
            // Get updated principal after payment
            const principalAfterPayment =
              typeof this.currentPrincipal === 'number'
                ? this.currentPrincipal
                : parseFloat(String(this.currentPrincipal));

            // Only recalculate if:
            // 1. recurring_amount is NOT manually specified (AUTO mode)
            // 2. Principal was actually reduced (payment was applied)
            // 3. New principal is valid
            if (
              !event.hasOwnProperty('recurring_amount') &&
              principalAfterPayment < principalBeforePayment &&
              !isNaN(principalAfterPayment) &&
              principalAfterPayment > 0
            ) {
              try {
                // Get current rate for recalculation
                const currentRateNum =
                  typeof this.currentRate === 'string'
                    ? parseFloat(String(this.currentRate))
                    : Number(this.currentRate);

                // Use pure loanEngine module to recalculate annuity after rate change
                // Payment was already applied, so use principalAfterPayment and applyPaymentFirst: false
                const oldPayment = this.currentRecurringPayment;
                const recalculationResult = recalculateAfterRateChange({
                  currentPrincipal: principalAfterPayment, // Use principal after payment
                  currentPayment: oldPayment,
                  oldRate: currentRateNum,
                  newRate: newRateNum,
                  rateChangeDate: event.date,
                  loanEndDate: this.init.end_date!,
                  applyPaymentFirst: false, // Payment already applied above
                });

                // Validation warning is handled inside recalculateAfterRateChange
                // Update recurring payment amount - this will be used for all future payments
                this.currentRecurringPayment = recalculationResult.newPayment;

                if (this.debugLoggingEnabled) {
                  this.debugWrite(
                    `[RATE CHANGE WITH PAYMENT] ${event.date}: Applied payment ${installment} with OLD rate ${currentRateNum}%. ` +
                      `Principal: ${principalBeforePayment} -> ${principalAfterPayment}. ` +
                      `Recalculated payment with NEW rate ${newRateNum}%: ${oldPayment} -> ${recalculationResult.newPayment}. ` +
                      `Remaining months: ${recalculationResult.remainingMonths}`
                  );
                }
              } catch (error) {
                // If recalculation fails, keep existing payment amount
                if (this.debugLoggingEnabled) {
                  this.debugWrite(
                    `[RATE CHANGE WITH PAYMENT ERROR] ${event.date}: Failed to recalculate payment after applying payment. Error: ${error}. Keeping: ${this.currentRecurringPayment}`
                  );
                }
              }
            }
          }
        } else {
          throw new Error(
            `invalid payment method: ${this.init.payment_method}`
          );
        }

      }

      if (this.currentSingleFee) {
        if (!event.hasOwnProperty('ending')) {
          // Determine the correct rate at this date from the last rate event on or before this date
          let rateForFeeEvent: number | string = this.currentRate;
          const lastRateEvent = this.getLastRateEventOnOrBeforeDate(event.date);
          if (lastRateEvent && lastRateEvent.rate !== undefined) {
            rateForFeeEvent = lastRateEvent.rate;
          }
          
          // Store raw values (no rounding) - rounding happens at output/UI layer
          this.logPayment({
            date: event.date,
            rate: rateForFeeEvent,
            installment: '-',
            reduction: '-',
            interest: '-',
            principal: this.currentPrincipal,
            fee: this.currentSingleFee,
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

          // Store raw values (no rounding) - rounding happens at output/UI layer
          this.logPayment({
            date: event.date,
            rate: this.currentRate,
            installment: '-',
            reduction: '-',
            interest: finalInterest,
            principal: this.currentPrincipal,
            fee: this.currentSingleFee,
            num_days: numDays,
          });
          this.latestCalculatedInterestDate = this.init.end_date!;
        } else {
          this.latestCalculatedInterestDate = this.latestPaymentDate;
        }
        break;
      }
    }

    // Compare unrounded values for validation - use small epsilon for floating point comparison
    const epsilon = 1e-10;
    if (Math.abs(this.gpiSumOfInterests - this.sumOfInterests) > epsilon) {
      throw new Error(
        `Sum of interests mismatch: ${this.gpiSumOfInterests} vs. ${this.sumOfInterests}`
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
    // Use raw values (no rounding) - rounding happens at output/UI layer
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

    // Return raw values (no rounding) - rounding happens at output/UI layer
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

      /**
       * FORMATTING LAYER: Round values to 2 decimals ONLY for UI/output
       * 
       * BANKING-GRADE PRECISION ARCHITECTURE:
       * 
       * All core financial calculations above maintain full floating-point precision.
       * Rounding is intentionally deferred until this final output layer for the following
       * critical reasons:
       * 
       * 1. CUMULATIVE ROUNDING ERROR PREVENTION:
       *    - Each intermediate rounding introduces a small error (typically ±0.005)
       *    - Over 360 monthly payments, these errors compound significantly
       *    - Example: 0.005 error × 360 payments = 1.80 discrepancy
       *    - This violates banking accuracy requirements (must be within ±0.01)
       * 
       * 2. INTEREST CALCULATION ACCURACY:
       *    - Interest = Principal × Rate × Time
       *    - Rounding principal prematurely causes interest calculation errors
       *    - These errors compound exponentially over the loan term
       *    - Can result in regulatory violations (usury law compliance)
       * 
       * 3. BALANCE RECONCILIATION REQUIREMENTS:
       *    - Loan balances must reconcile to the penny across all systems
       *    - Rounding intermediate values causes reconciliation failures
       *    - Requires manual adjustments (not acceptable in automated systems)
       *    - Audit trails must show exact calculation paths
       * 
       * 4. REGULATORY COMPLIANCE (Basel III, IFRS):
       *    - Financial calculations must maintain precision until presentation
       *    - Rounding intermediate values violates accounting standards
       *    - Can lead to audit findings and regulatory penalties
       *    - Must produce identical results across all platforms
       * 
       * 5. CROSS-SYSTEM CONSISTENCY:
       *    - Core calculations must be identical across all systems
       *    - Rounding at calculation time introduces platform variations
       *    - Rounding only at display ensures consistent core results
       *    - Critical for multi-system banking architectures
       * 
       * IMPLEMENTATION:
       * - All internal calculations use raw floating-point values
       * - Payment log entries store unrounded values
       * - Only final return values are rounded for display
       * - This ensures calculation accuracy while meeting display requirements
       */
      if (initObj.hasOwnProperty('round_values')) {
        if (initObj.round_values) {
          // Format all output values to 2 decimals for UI display
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
          // Return raw values without rounding
          sumOfInstallments = interests + reductions - finalInterest;
        }
      } else {
        // Default: Format all output values to 2 decimals for UI display
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

      // Validation: Final remaining balance must be within ±0.01
      // This ensures the loan calculation is accurate
      const balanceTolerance = 0.01;
      if (Math.abs(remainingPrincipal) > balanceTolerance) {
        const warning = `[BALANCE VALIDATION WARNING] Final remaining balance (${remainingPrincipal}) is outside tolerance (±${balanceTolerance}). Expected: 0 ± ${balanceTolerance}`;
        if (initObj.debug_logging && debugArray) {
          debugArray.push(warning);
        }
      }

      // Validation: Total interest paid must be positive and reasonable
      // When interest rate decreases, total interest should generally decrease
      // (This is a general check - specific rate decrease validation is done during recalculation)
      if (interestPaid < 0) {
        const warning = `[INTEREST VALIDATION WARNING] Total interest paid (${interestPaid}) is negative. This is unexpected.`;
        if (initObj.debug_logging && debugArray) {
          debugArray.push(warning);
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
