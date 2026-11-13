import type {
  ApiLoan,
  PaymentRecord,
  ProfilePatch,
  TransactionOrIncomeItem,
  UserProfile,
} from '../../types';
import type { TagCatalog } from '../../../tags/catalog';

const first = (value: unknown): unknown => {
  const entry = Array.isArray(value) ? value[0] : value;
  if (entry && typeof entry === 'object' && entry !== null) {
    return (
      (entry as { value?: unknown }).value ??
      (entry as { target_id?: unknown }).target_id ??
      entry
    );
  }
  return entry;
};

const asText = (value: unknown) =>
  value === undefined || value === null ? '' : String(value);

/** Read encrypted payload from domain or Drupal field shapes. */
export const readEncryptedPayload = (body: any): string | null => {
  const value =
    body?.encrypted_payload ??
    body?.payload ??
    first(body?.field_encrypted_payload);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const transactionRowFromBody = (
  body: any,
  userId: string,
  resolvedId?: string
) => {
  const type = asText(body.type || 'transaction');
  const encrypted = readEncryptedPayload(body);
  const row: Record<string, unknown> = {
    user_id: userId,
    type,
    amount: asText(first(body.field_amount) ?? body.sum ?? body.amount),
    date: asText(first(body.field_date) ?? body.dt ?? body.date),
    description: asText(
      first(body.field_description) ?? body.dsc ?? body.description
    ),
    category:
      type === 'transaction'
        ? asText(first(body.field_category) ?? body.cat ?? body.category)
        : null,
    encrypted_payload: encrypted,
  };
  if (resolvedId) row.id = resolvedId;
  return row;
};

export const transactionFromRow = (row: any): TransactionOrIncomeItem => {
  const dt = asText(row.date);
  return {
    id: String(row.id),
    type: asText(row.type || 'transaction'),
    sum: asText(row.amount),
    dt,
    dsc: asText(row.description),
    cat: row.category != null ? asText(row.category) : undefined,
    cr: row.created_at
      ? new Date(row.created_at).getTime()
      : dt
        ? new Date(dt).getTime()
        : Date.now(),
    ...(row.encrypted_payload
      ? { encrypted_payload: row.encrypted_payload }
      : {}),
  } as TransactionOrIncomeItem;
};

const LOAN_SHORT_TO_COL: Record<string, string> = {
  title: 'title',
  fp: 'fp',
  sdt: 'sdt',
  edt: 'edt',
  fr: 'fr',
  fpm: 'fpm',
  fif: 'fif',
  pdt: 'pdt',
  frpd: 'frpd',
  fls: 'fls',
};

const LOAN_DRUPAL_TO_SHORT: Array<[string, string]> = [
  ['title', 'title'],
  ['field_principal', 'fp'],
  ['field_start_date', 'sdt'],
  ['field_end_date', 'edt'],
  ['field_rate', 'fr'],
  ['field_payment_method', 'fpm'],
  ['field_initial_fee', 'fif'],
  ['field_rec_first_payment_date', 'pdt'],
  ['field_recurring_payment_day', 'frpd'],
  ['field_loan_status', 'fls'],
];

export const loanRowFromBody = (
  body: any,
  userId: string,
  resolvedId?: string
) => {
  const encrypted = readEncryptedPayload(body);
  const row: Record<string, unknown> = {
    user_id: userId,
    encrypted_payload: encrypted,
  };
  if (resolvedId) row.id = resolvedId;

  for (const [drupal, short] of LOAN_DRUPAL_TO_SHORT) {
    if (body[drupal] !== undefined) {
      row[short] = asText(first(body[drupal]));
    } else if (body[short] !== undefined) {
      row[short] = asText(body[short]);
    }
  }
  if (body.title !== undefined && !Array.isArray(body.title)) {
    row.title = asText(body.title);
  }
  return row;
};

export const loanFromRow = (row: any): ApiLoan => {
  const loan: ApiLoan = { id: String(row.id) };
  for (const key of Object.keys(LOAN_SHORT_TO_COL)) {
    if (row[key] != null && row[key] !== '') loan[key] = row[key];
  }
  if (row.encrypted_payload) {
    (loan as any).encrypted_payload = row.encrypted_payload;
  }
  if (row.created_at) {
    (loan as any).cr = new Date(row.created_at).getTime();
  }
  return loan;
};

const PAYMENT_DRUPAL_TO_SHORT: Array<[string, string]> = [
  ['title', 'title'],
  ['field_date', 'fdt'],
  ['field_rate', 'fr'],
  ['field_pay_installment', 'fpi'],
  ['field_pay_single_fee', 'fpsf'],
  ['field_new_recurring_amount', 'fnra'],
  ['field_new_principal', 'fnp'],
  ['field_payment_method', 'fpm'],
  ['field_is_simulated_payment', 'fisp'],
];

export const paymentRowFromBody = (
  body: any,
  userId: string,
  resolvedId?: string,
  resolvedLoanId?: string
) => {
  const encrypted = readEncryptedPayload(body);
  const loanId =
    resolvedLoanId ||
    asText(first(body.field_loan_reference) ?? body.loan_id ?? body.loanId);
  const row: Record<string, unknown> = {
    user_id: userId,
    loan_id: loanId || null,
    encrypted_payload: encrypted,
  };
  if (resolvedId) row.id = resolvedId;
  for (const [drupal, short] of PAYMENT_DRUPAL_TO_SHORT) {
    if (body[drupal] !== undefined) {
      row[short] = asText(first(body[drupal]));
    } else if (body[short] !== undefined) {
      row[short] = asText(body[short]);
    }
  }
  return row;
};

export const paymentFromRow = (row: any): PaymentRecord => {
  const payment: PaymentRecord = {
    id: String(row.id),
    loan_id: row.loan_id ? String(row.loan_id) : undefined,
    title: row.title,
    fdt: row.fdt,
    fr: row.fr,
    fpi: row.fpi,
    fpsf: row.fpsf,
    fnra: row.fnra,
    fnp: row.fnp,
    fpm: row.fpm,
    fisp: row.fisp,
  };
  if (row.encrypted_payload) {
    payment.encrypted_payload = row.encrypted_payload;
  }
  if (row.created_at) {
    (payment as any).cr = new Date(row.created_at).getTime();
  }
  return payment;
};

export const profileFromRow = (row: any): UserProfile => ({
  uid: String(row.id),
  currency: row.currency || undefined,
  encryption_status: row.encryption_status || undefined,
  gemini_api_key: row.gemini_api_key || '',
  tag_mode: row.tag_mode === 'custom' ? 'custom' : 'default',
  custom_tags: (row.custom_tags as TagCatalog['custom']) || {},
  preferences:
    row.preferences && typeof row.preferences === 'object'
      ? row.preferences
      : undefined,
  raw: row,
});

export const profileUpdateFromPatch = (patch: ProfilePatch) => {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.encryption_status !== undefined) {
    update.encryption_status = patch.encryption_status;
  }
  if (patch.gemini_api_key !== undefined) {
    update.gemini_api_key = patch.gemini_api_key;
  }
  if (patch.tag_mode !== undefined) update.tag_mode = patch.tag_mode;
  if (patch.custom_tags !== undefined) update.custom_tags = patch.custom_tags;
  if (patch.preferences !== undefined) update.preferences = patch.preferences;
  return update;
};
