/** Title keywords that mark an advance/extra payment (not the regular installment). */
export const EARLY_PAYMENT_TITLE_KEYS = [
  'anticipat',
  'avans',
  'înainte',
  'inainte',
  'prematur',
  'extra',
  'suplimentar',
  'early',
  'advance',
  'premature',
  'additional',
] as const;

/** Share of recurring amount below which a payment is treated as advance/extra. */
export const SMALL_INSTALLMENT_RATIO = 0.5;

export function isEarlyPaymentByTitle(
  title: string | null | undefined
): boolean {
  const normalized = (title ?? '').toLowerCase();
  return EARLY_PAYMENT_TITLE_KEYS.some((key) => normalized.includes(key));
}

export function isSmallInstallment(
  amount: number,
  recurringAmount: number
): boolean {
  return (
    recurringAmount > 0 &&
    amount > 0 &&
    amount < recurringAmount * SMALL_INSTALLMENT_RATIO
  );
}
