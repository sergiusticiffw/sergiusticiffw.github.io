// The only place where items cross the encryption boundary:
// decodeServerItem (Drupal -> app) and encodeNodeBody (app -> Drupal).
// Everything on the device (IndexedDB, offline queue, UI) stays plain.
import { TransactionOrIncomeItem } from '@shared/type/types';
import {
  aadFor,
  decryptPayload,
  encryptPayload,
  isBundlePayload,
  PlainPayload,
} from './cipher';
import { getEncryptionSnapshot, getSession } from './encryptionState';
import { getCryptoKey } from './keyStore';

export const ENCRYPTED_TITLE = '•';

export type DecodeResult =
  | { kind: 'ok'; item: TransactionOrIncomeItem }
  | { kind: 'locked'; id: string }
  | { kind: 'corrupt'; id: string };

export type EncodeResult =
  | { kind: 'send'; body: Record<string, unknown> }
  | { kind: 'hold'; reason: 'status-unknown' | 'transition' | 'key-needed' };

const first = (value: any): any => {
  const entry = Array.isArray(value) ? value[0] : value;
  if (entry && typeof entry === 'object') {
    return entry.value ?? entry.target_id;
  }
  return entry;
};

const hasCategory = (type: string) => type === 'transaction';

/** Works with both the /api/expenses list rows and full node JSON. */
export const extractPayload = (record: any): string | null => {
  const value = record?.payload ?? first(record?.field_encrypted_payload);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const recordType = (record: any): string =>
  typeof record?.type === 'string' ? record.type : first(record?.type) || '';

export const toPlain = (
  type: string,
  values: { sum?: unknown; dt?: unknown; dsc?: unknown; cat?: unknown }
): PlainPayload => ({
  v: 1,
  sum: values.sum === undefined || values.sum === null ? '' : String(values.sum),
  dt: values.dt ? String(values.dt) : '',
  dsc: values.dsc ? String(values.dsc) : '',
  ...(hasCategory(type) ? { cat: values.cat ? String(values.cat) : '' } : {}),
});

export const plainFromFormData = (data: any): PlainPayload =>
  toPlain(data.type, {
    sum: first(data.field_amount),
    dt: first(data.field_date),
    dsc: first(data.field_description),
    cat: first(data.field_category),
  });

const LOAN_FIELDS: Array<[string, string]> = [
  ['title', 'title'],
  ['fp', 'field_principal'],
  ['sdt', 'field_start_date'],
  ['edt', 'field_end_date'],
  ['fr', 'field_rate'],
  ['fpm', 'field_payment_method'],
  ['fif', 'field_initial_fee'],
  ['pdt', 'field_rec_first_payment_date'],
  ['frpd', 'field_recurring_payment_day'],
  ['fls', 'field_loan_status'],
];

const PAYMENT_FIELDS: Array<[string, string]> = [
  ['title', 'title'],
  ['fdt', 'field_date'],
  ['fr', 'field_rate'],
  ['fpi', 'field_pay_installment'],
  ['fpsf', 'field_pay_single_fee'],
  ['fnra', 'field_new_recurring_amount'],
  ['fnp', 'field_new_principal'],
  ['fpm', 'field_payment_method'],
  ['fisp', 'field_is_simulated_payment'],
];

const asText = (value: unknown) =>
  value === undefined || value === null ? '' : String(value);

const fieldsFromForm = (pairs: Array<[string, string]>, data: any) => {
  const fields: Record<string, string> = {};
  for (const [short, drupal] of pairs) {
    fields[short] = asText(first(data[drupal]));
  }
  return fields;
};

export const loanFieldsFromRow = (row: any): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const [short] of LOAN_FIELDS) fields[short] = asText(row?.[short]);
  return fields;
};

export const paymentFieldsFromRow = (row: any): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const [short] of PAYMENT_FIELDS) fields[short] = asText(row?.[short]);
  return fields;
};

const cleared = (pairs: Array<[string, string]>) => {
  const body: Record<string, unknown> = {};
  for (const [, drupal] of pairs) {
    if (drupal === 'title') body.title = [ENCRYPTED_TITLE];
    else body[drupal] = [];
  }
  return body;
};

const filled = (pairs: Array<[string, string]>, fields: Record<string, string>) => {
  const body: Record<string, unknown> = {};
  for (const [short, drupal] of pairs) {
    const value = fields[short] || '';
    body[drupal] = value === '' ? [] : [drupal === 'field_is_simulated_payment' ? Number(value) || 0 : value];
  }
  return body;
};

/** Node body with every sensitive field emptied. Payment keeps field_loan_reference. */
export const encryptedNodeShell = (
  type: string,
  ref?: string
): Record<string, unknown> => {
  if (type === 'loan') {
    return { type, ...cleared(LOAN_FIELDS) };
  }
  if (type === 'payment') {
    return {
      type,
      ...cleared(PAYMENT_FIELDS),
      ...(ref ? { field_loan_reference: [ref] } : {}),
    };
  }
  return {
    type,
    title: [ENCRYPTED_TITLE],
    field_amount: [],
    field_date: [],
    field_description: [],
    ...(hasCategory(type) ? { field_category: [] } : {}),
  };
};

export const plainNodeBody = (
  type: string,
  plain: PlainPayload,
  ref?: string
): Record<string, unknown> => {
  if (isBundlePayload(plain)) {
    const pairs = plain.kind === 'loan' ? LOAN_FIELDS : PAYMENT_FIELDS;
    return {
      type,
      ...filled(pairs, plain.fields),
      ...(plain.kind === 'payment' && ref ? { field_loan_reference: [ref] } : {}),
    };
  }
  return {
    type,
    title: [plain.dt],
    field_amount: [plain.sum],
    field_date: [plain.dt],
    field_description: [plain.dsc],
    ...(hasCategory(type) ? { field_category: [plain.cat || ''] } : {}),
  };
};

/** Overlays the decrypted values on an item built from the plain fields. */
export const decodeServerItem = async (
  record: any,
  base: TransactionOrIncomeItem
): Promise<DecodeResult> => {
  const payload = extractPayload(record);
  if (!payload) {
    return { kind: 'ok', item: base };
  }
  const session = getSession();
  const key = await getCryptoKey();
  if (!key || !session) {
    return { kind: 'locked', id: base.id };
  }
  try {
    const plain = await decryptPayload(key, payload, aadFor(session.uid, base.type));
    return {
      kind: 'ok',
      item: {
        ...base,
        sum: plain.sum,
        dt: plain.dt,
        dsc: plain.dsc,
        cat: plain.cat ?? '',
      },
    };
  } catch {
    return { kind: 'corrupt', id: base.id };
  }
};

/** Builds the POST/PATCH body at send time, so the status at that moment decides the format. */
export const encodeNodeBody = async (data: any): Promise<EncodeResult> => {
  const { status } = getEncryptionSnapshot();
  if (status === 'off') {
    return { kind: 'send', body: data };
  }
  if (status === null) {
    return { kind: 'hold', reason: 'status-unknown' };
  }
  if (status !== 'on') {
    return { kind: 'hold', reason: 'transition' };
  }
  const session = getSession();
  const key = await getCryptoKey();
  if (!key || !session) {
    return { kind: 'hold', reason: 'key-needed' };
  }
  const type = data.type;
  const ref =
    type === 'payment' ? asText(first(data.field_loan_reference)) : '';
  const plain: PlainPayload =
    type === 'loan'
      ? { v: 1, kind: 'loan', fields: fieldsFromForm(LOAN_FIELDS, data) }
      : type === 'payment'
        ? { v: 1, kind: 'payment', fields: fieldsFromForm(PAYMENT_FIELDS, data) }
        : plainFromFormData(data);
  const payload = await encryptPayload(key, plain, aadFor(session.uid, type));
  return {
    kind: 'send',
    body: {
      ...encryptedNodeShell(type, ref || undefined),
      field_encrypted_payload: [payload],
    },
  };
};

export type BundleDecodeResult<T> =
  | { kind: 'ok'; item: T }
  | { kind: 'locked'; id: string }
  | { kind: 'corrupt'; id: string };

/** Decrypts a loan or payment list row. Without a payload the row is returned unchanged. */
export const decodeBundleRecord = async <T extends Record<string, unknown>>(
  record: T,
  type: 'loan' | 'payment'
): Promise<BundleDecodeResult<T>> => {
  const id = asText((record as { id?: unknown }).id);
  const payload = extractPayload(record);
  const { payload: _payload, field_encrypted_payload: _field, ...rest } = record as any;
  if (!payload) {
    return { kind: 'ok', item: rest as T };
  }
  const session = getSession();
  const key = await getCryptoKey();
  if (!key || !session) {
    return { kind: 'locked', id };
  }
  try {
    const plain = await decryptPayload(key, payload, aadFor(session.uid, type));
    if (!isBundlePayload(plain) || plain.kind !== type) {
      return { kind: 'corrupt', id };
    }
    return { kind: 'ok', item: { ...rest, ...plain.fields } as T };
  } catch {
    return { kind: 'corrupt', id };
  }
};
