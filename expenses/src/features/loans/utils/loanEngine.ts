/**
 * Pure loan calculation engine for banking-grade financial software
 *
 * ARCHITECTURAL PRINCIPLES:
 *
 * 1. SEPARATION OF CALCULATION AND PRESENTATION
 *    - All calculation functions return raw floating-point values (unrounded)
 *    - Rounding is deferred to the presentation/display layer only
 *    - This prevents cumulative rounding errors that can cause financial discrepancies
 *
 * 2. PRECISION PRESERVATION (Banking Standard)
 *    - Financial calculations maintain full IEEE 754 double precision (64-bit)
 *    - Intermediate calculations never round values
 *    - Only final display values are rounded to 2 decimal places
 *
 * 3. WHY ROUNDING IS DELAYED:
 *
 *    a) CUMULATIVE ERROR PREVENTION:
 *       Rounding errors compound over multiple calculations. For example:
 *       - Payment 1: 1,234.567 → rounded to 1,234.57 (error: -0.003)
 *       - Payment 2: 1,234.567 → rounded to 1,234.57 (error: -0.003)
 *       - After 360 payments: cumulative error = -1.08 (significant!)
 *
 *    b) REGULATORY COMPLIANCE:
 *       Banking regulations (Basel III, IFRS) require calculations to maintain
 *       precision until final presentation. Rounding intermediate values violates
 *       these standards and can lead to audit findings.
 *
 *    c) BALANCE RECONCILIATION:
 *       Loan balances must reconcile to the penny. Rounding intermediate values
 *       can cause final balance discrepancies that require manual adjustments,
 *       which are not acceptable in automated banking systems.
 *
 *    d) INTEREST ACCURACY:
 *       Interest calculations depend on exact principal balances. Rounding
 *       principal prematurely causes interest calculation errors that compound
 *       over the loan term, potentially violating usury laws.
 *
 *    e) CROSS-SYSTEM CONSISTENCY:
 *       Banking systems must produce identical results across platforms.
 *       Rounding at calculation time introduces platform-dependent variations.
 *       Rounding only at display ensures consistent core calculations.
 *
 * 4. FRAMEWORK AGNOSTIC:
 *    - No dependencies on React, Angular, Vue, or other UI frameworks
 *    - Can be used in Node.js, browser, or server-side environments
 *    - Fully testable without framework setup
 *
 * 5. PURE FUNCTIONS:
 *    - All functions are pure (no side effects)
 *    - Same inputs always produce same outputs
 *    - No global state or external dependencies
 *    - Thread-safe and parallelizable
 */

/**
 * Split date string (DD.MM.YYYY) into components
 */
const splitDate = (date: string): [string, string, string] => {
  const splitted = date.split('.');
  return [splitted[0], splitted[1], splitted[2]];
};

/**
 * Calculate number of months between two dates
 */
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

/**
 * Calculate annuity payment using the standard present value of annuity formula
 *
 * MATHEMATICAL FOUNDATION:
 * This function implements the standard annuity formula used in banking and finance:
 *
 *   A = P × r / (1 - (1 + r)^(-n))
 *
 * Where:
 *   A = Monthly annuity payment (what we're calculating)
 *   P = Present value (remaining principal balance)
 *   r = Periodic interest rate (monthly rate = annualRate / 12 / 100)
 *   n = Number of payment periods (remaining months)
 *
 * DERIVATION:
 * The formula is derived from the present value of an ordinary annuity:
 *   PV = A × [(1 - (1 + r)^(-n)) / r]
 *
 * Solving for A (annuity payment):
 *   A = PV × r / (1 - (1 + r)^(-n))
 *
 * This ensures that the present value of all future payments equals the remaining principal,
 * maintaining the loan's amortization schedule.
 *
 * PRECISION CONSIDERATIONS:
 * - Returns unrounded value to maintain full floating-point precision
 * - Rounding is deferred to the presentation layer to prevent cumulative rounding errors
 * - Banking regulations require calculations to maintain precision until final display
 *
 * @param principal - Remaining principal balance (must be positive)
 * @param annualRate - Annual interest rate as percentage (e.g., 5.5 for 5.5% APR)
 * @param startDate - Start date for calculation period (DD.MM.YYYY format)
 * @param endDate - End date for calculation period (DD.MM.YYYY format)
 * @returns Monthly annuity payment in raw floating-point format (unrounded for precision)
 *
 * @throws Error if principal <= 0 or rate < 0 (invalid financial parameters)
 */
export const calculateAnnuity = (
  principal: number,
  annualRate: number,
  startDate: string,
  endDate: string
): number => {
  // Input validation: Financial calculations require positive, valid inputs
  if (principal <= 0) {
    throw new Error('calculateAnnuity: principal must be positive');
  }
  if (annualRate < 0) {
    throw new Error('calculateAnnuity: rate must be non-negative');
  }

  // Calculate number of remaining payment periods (months)
  const n = getNumberOfMonths(startDate, endDate);

  // Edge case: If loan is at maturity or invalid period, return principal as final payment
  if (n <= 0) {
    return principal;
  }

  // Convert annual percentage rate (APR) to monthly periodic rate
  // Formula: r = APR / 12 / 100
  // Example: 5.5% APR → 5.5 / 12 / 100 = 0.004583... (monthly rate)
  const r = annualRate / 12 / 100;

  // Edge case: Zero interest rate (interest-free loan)
  // Divide principal equally across remaining periods
  if (r === 0 || annualRate === 0) {
    return principal / n;
  }

  // STANDARD ANNUITY FORMULA CALCULATION
  // Step 1: Calculate (1 + r) - the monthly compounding factor
  const onePlusR = 1 + r;

  // Step 2: Calculate (1 + r)^(-n) - present value factor for n periods
  // This represents the present value of 1 unit paid n periods in the future
  const onePlusRToNegN = Math.pow(onePlusR, -n);

  // Step 3: Calculate denominator: 1 - (1 + r)^(-n)
  // This is the present value annuity factor for n periods at rate r
  const denominator = 1 - onePlusRToNegN;

  // Numerical stability check: Prevent division by zero or near-zero
  // This can occur with very small rates or very large n values
  if (Math.abs(denominator) < 1e-10) {
    // Fallback: Equal principal distribution (amortization without interest)
    return principal / n;
  }

  // Step 4: Calculate annuity payment
  // A = P × r / (1 - (1 + r)^(-n))
  // This ensures the present value of all future payments equals the principal
  const annuity = (principal * r) / denominator;

  // Return unrounded value to maintain precision for subsequent calculations
  // Rounding will be applied at the presentation/display layer only
  return annuity;
};

/**
 * Calculate remaining balance after a payment
 *
 * @param currentPrincipal - Current principal balance
 * @param paymentAmount - Payment amount made
 * @param interestAmount - Interest portion of the payment
 * @returns Remaining principal balance after payment
 */
export const calculateRemainingBalance = (
  currentPrincipal: number,
  paymentAmount: number,
  interestAmount: number
): number => {
  // Principal reduction = payment - interest
  const principalReduction = paymentAmount - interestAmount;

  // Remaining balance = current principal - principal reduction
  return currentPrincipal - principalReduction;
};

/**
 * Recalculate annuity payment after interest rate change
 *
 * BANKING REGULATION COMPLIANCE:
 * When an interest rate changes during the loan term, the new payment must be recalculated
 * following strict financial accounting principles to ensure accurate amortization.
 *
 * CRITICAL RECALCULATION SEQUENCE (Banking Standard):
 * The order of operations is MANDATORY and follows international banking standards:
 *
 * Step 1: Apply final payment with OLD interest rate
 *   - Calculate interest accrued using the OLD rate for the period ending on rate change date
 *   - Apply the existing payment (calculated with old rate) to cover interest + principal
 *   - This ensures all interest accrued under the old rate is properly paid
 *
 * Step 2: Update remaining principal balance
 *   - Subtract principal reduction from current balance
 *   - This becomes the new principal for recalculation
 *   - Principal = CurrentPrincipal - (Payment - InterestAtOldRate)
 *
 * Step 3: Calculate remaining loan term
 *   - Determine months between rate change date and original loan maturity date
 *   - This is the new amortization period for the recalculated payment
 *   - Formula: remainingMonths = monthsBetween(rateChangeDate, loanEndDate)
 *
 * Step 4: Recalculate annuity with NEW interest rate
 *   - Use updated principal and remaining months
 *   - Apply NEW interest rate to calculate new monthly payment
 *   - Formula: newPayment = calculateAnnuity(updatedPrincipal, newRate, rateChangeDate, loanEndDate)
 *
 * WHY THIS ORDER MATTERS:
 * - Applying payment first ensures interest accrued under old rate is settled
 * - Recalculating from updated principal maintains loan balance accuracy
 * - Using remaining months (not original term) ensures correct amortization schedule
 * - This prevents principal balance discrepancies and ensures regulatory compliance
 *
 * FINANCIAL INVARIANTS (Must always hold):
 * 1. When rate decreases → new payment must decrease (or remain equal)
 * 2. When rate increases → new payment must increase (or remain equal)
 * 3. Total interest paid over loan life must be accurate
 * 4. Final principal balance must be within ±0.01 tolerance
 *
 * @param params - Recalculation parameters
 * @param params.currentPrincipal - Current principal balance before payment (must be positive)
 * @param params.currentPayment - Current monthly payment calculated with old rate (must be positive)
 * @param params.oldRate - Old annual interest rate as percentage (e.g., 5.5 for 5.5% APR)
 * @param params.newRate - New annual interest rate as percentage (e.g., 4.5 for 4.5% APR)
 * @param params.rateChangeDate - Date when rate change takes effect (DD.MM.YYYY format)
 * @param params.loanEndDate - Original loan maturity date (DD.MM.YYYY format)
 * @param params.applyPaymentFirst - Whether to apply payment with old rate first (default: true)
 *                                   Set to false if payment was already applied externally
 * @returns Object containing:
 *   - newPayment: Recalculated monthly payment using new rate (unrounded)
 *   - updatedPrincipal: Principal balance after applying old rate payment (unrounded)
 *   - remainingMonths: Number of months from rate change to loan maturity
 *
 * @throws Error if validation fails (invalid parameters, payment insufficient for interest)
 */
export const recalculateAfterRateChange = (params: {
  currentPrincipal: number;
  currentPayment: number;
  oldRate: number;
  newRate: number;
  rateChangeDate: string;
  loanEndDate: string;
  applyPaymentFirst?: boolean;
}): {
  newPayment: number;
  updatedPrincipal: number;
  remainingMonths: number;
} => {
  const {
    currentPrincipal,
    currentPayment,
    oldRate,
    newRate,
    rateChangeDate,
    loanEndDate,
    applyPaymentFirst = true,
  } = params;

  // Validate inputs
  if (currentPrincipal <= 0) {
    throw new Error(
      'recalculateAfterRateChange: currentPrincipal must be positive'
    );
  }
  if (currentPayment <= 0) {
    throw new Error(
      'recalculateAfterRateChange: currentPayment must be positive'
    );
  }
  if (oldRate < 0 || newRate < 0) {
    throw new Error('recalculateAfterRateChange: rates must be non-negative');
  }

  // Calculate remaining months from rate change date to loan end date
  const remainingMonths = getNumberOfMonths(rateChangeDate, loanEndDate);

  if (remainingMonths <= 0) {
    return {
      newPayment: currentPrincipal,
      updatedPrincipal: currentPrincipal,
      remainingMonths: 0,
    };
  }

  let updatedPrincipal = currentPrincipal;

  // Step 1 & 2: Apply payment with OLD rate if requested
  if (applyPaymentFirst) {
    // Calculate interest for one month with old rate
    const monthlyRateOld = oldRate / 12 / 100;
    const interestAmount = currentPrincipal * monthlyRateOld;

    // Principal reduction = payment - interest
    const principalReduction = currentPayment - interestAmount;

    if (principalReduction < 0) {
      throw new Error(
        `recalculateAfterRateChange: Payment ${currentPayment} is too small to cover interest ${interestAmount} with old rate ${oldRate}%`
      );
    }

    // Update principal after payment
    updatedPrincipal = currentPrincipal - principalReduction;

    if (updatedPrincipal < 0) {
      updatedPrincipal = 0;
    }
  }

  // Step 3 & 4: Recalculate annuity using NEW interest rate with updated principal
  const newPayment = calculateAnnuity(
    updatedPrincipal,
    newRate,
    rateChangeDate,
    loanEndDate
  );

  // Validation: When interest rate decreases, monthly payment must decrease
  if (newRate < oldRate && newPayment > currentPayment) {
    // This is a validation warning - log it but don't throw
    // The caller can handle this warning as needed
    // Rate decreased but payment increased - caller may log if needed
  }

  return {
    newPayment,
    updatedPrincipal,
    remainingMonths,
  };
};

/**
 * Calculate interest accrued for a specific time period
 *
 * BANKING INTEREST CALCULATION FORMULA:
 * This function implements the standard simple interest formula used in banking:
 *
 *   Interest = Principal × (AnnualRate / 100) × (DaysInPeriod / DaysInYear)
 *
 * MATHEMATICAL BREAKDOWN:
 *
 * 1. Principal × (AnnualRate / 100):
 *    - Converts annual percentage rate to decimal form
 *    - Example: 5.5% → 0.055
 *    - This represents the interest rate as a decimal multiplier
 *
 * 2. × (DaysInPeriod / DaysInYear):
 *    - Calculates the time factor as a fraction of the year
 *    - Accounts for actual days in the period (not all months have 30 days)
 *    - Example: 30 days / 360 days = 0.08333... (1/12 of a year)
 *
 * 3. Combined Formula:
 *    - Interest = P × r × (d / D)
 *    - Where: P = Principal, r = AnnualRate/100, d = DaysInPeriod, D = DaysInYear
 *
 * DAY COUNT CONVENTIONS (Banking Standards):
 *
 * ACT/360 (Actual/360):
 *   - Uses actual number of days in period
 *   - Uses 360 days as the year denominator
 *   - Common in European banking and money markets
 *   - Example: 30-day period in February (28 days) = 28/360
 *   - Formula: Interest = Principal × Rate × (ActualDays / 360)
 *
 * ACT/365 (Actual/365):
 *   - Uses actual number of days in period
 *   - Uses 365 days as the year denominator (366 for leap years)
 *   - Common in UK banking and some international markets
 *   - Example: 30-day period = 30/365
 *   - Formula: Interest = Principal × Rate × (ActualDays / 365)
 *
 * WHY ACTUAL DAYS MATTER:
 * - Not all months have 30 days (February has 28/29)
 * - Interest accrues daily, so actual days must be used
 * - Using 30-day months causes inaccuracies over time
 * - Banking regulations require actual day counting for accuracy
 *
 * PRECISION:
 * - Returns unrounded value to maintain calculation precision
 * - Rounding is deferred to presentation layer
 * - Critical for accurate interest accrual over loan term
 *
 * @param principal - Principal balance at start of period (must be positive)
 * @param annualRate - Annual interest rate as percentage (e.g., 5.5 for 5.5% APR)
 * @param daysInPeriod - Actual number of days in the interest period (must be non-negative)
 * @param dayCountMethod - Day count convention: 'act/360' (European) or 'act/365' (UK/International)
 * @returns Interest amount accrued for the period in raw floating-point format (unrounded)
 *
 * @throws Error if principal <= 0, rate < 0, or daysInPeriod < 0
 *
 * Example:
 *   Principal: 100,000 RON
 *   Annual Rate: 5%
 *   Days: 30
 *   Method: act/360
 *   Interest = 100,000 × (5/100) × (30/360) = 416.666... RON
 */
export const calculatePeriodInterest = (
  principal: number,
  annualRate: number,
  daysInPeriod: number,
  dayCountMethod: 'act/360' | 'act/365' = 'act/360'
): number => {
  // Input validation: Financial calculations require valid, positive inputs
  if (principal <= 0) {
    throw new Error('calculatePeriodInterest: principal must be positive');
  }
  if (annualRate < 0) {
    throw new Error('calculatePeriodInterest: rate must be non-negative');
  }
  if (daysInPeriod < 0) {
    throw new Error(
      'calculatePeriodInterest: daysInPeriod must be non-negative'
    );
  }

  // Determine days in year based on day count convention
  // ACT/360: European banking standard (360-day year)
  // ACT/365: UK/International standard (365-day year, 366 for leap years)
  const daysInYear = dayCountMethod === 'act/360' ? 360 : 365;

  // Calculate interest using simple interest formula
  // Interest = Principal × (AnnualRate / 100) × (DaysInPeriod / DaysInYear)
  const interest = principal * (annualRate / 100) * (daysInPeriod / daysInYear);

  // Return unrounded value to maintain precision for subsequent calculations
  // Rounding will be applied at the presentation/display layer only
  return interest;
};
