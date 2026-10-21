const VERSION = 'v1';
const IV_BYTES = 12;

export interface MoneyPayload {
  v: 1;
  sum: string;
  dt: string;
  dsc: string;
  cat?: string;
}

/** Loan and payment nodes. `fields` uses the short names the list APIs already return. */
export interface BundlePayload {
  v: 1;
  kind: 'loan' | 'payment';
  fields: Record<string, string>;
}

export type PlainPayload = MoneyPayload | BundlePayload;

export const isBundlePayload = (value: PlainPayload): value is BundlePayload =>
  'kind' in value && (value.kind === 'loan' || value.kind === 'payment');

export class DecryptError extends Error {
  constructor(message = "Couldn't decrypt this item") {
    super(message);
    this.name = 'DecryptError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

/** Binds a payload to its owner and bundle, so it can't be moved to another user or type. */
export const aadFor = (uid: string | number, type: string) =>
  `exp:${VERSION}:${uid}:${type}`;

export const importKey = (raw: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);

export const encryptPayload = async (
  key: CryptoKey,
  plain: PlainPayload,
  aad: string
): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(JSON.stringify(plain))
  );
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
};

export const decryptPayload = async (
  key: CryptoKey,
  payload: string,
  aad: string
): Promise<PlainPayload> => {
  const [version, ivPart, dataPart] = (payload || '').trim().split('.');
  if (version !== VERSION || !ivPart || !dataPart) {
    throw new DecryptError('Unknown payload format');
  }
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64Url(ivPart) as BufferSource,
        additionalData: encoder.encode(aad),
      },
      key,
      fromBase64Url(dataPart) as BufferSource
    );
  } catch {
    throw new DecryptError();
  }
  const parsed = JSON.parse(decoder.decode(plaintext));
  if (!parsed || parsed.v !== 1) {
    throw new DecryptError('Unexpected payload contents');
  }
  if (parsed.kind === 'loan' || parsed.kind === 'payment') {
    if (!parsed.fields || typeof parsed.fields !== 'object') {
      throw new DecryptError('Unexpected payload contents');
    }
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.fields)) {
      if (typeof value === 'string' || typeof value === 'number') {
        fields[key] = String(value);
      }
    }
    return { v: 1, kind: parsed.kind, fields };
  }
  if (typeof parsed.sum !== 'string' || typeof parsed.dt !== 'string') {
    throw new DecryptError('Unexpected payload contents');
  }
  return {
    v: 1,
    sum: parsed.sum,
    dt: parsed.dt,
    dsc: typeof parsed.dsc === 'string' ? parsed.dsc : '',
    ...(typeof parsed.cat === 'string' ? { cat: parsed.cat } : {}),
  };
};

const normalizeSum = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : (value || '').trim();
};

const DATE_FIELDS = new Set(['dt', 'sdt', 'edt', 'pdt', 'fdt']);

const normalizeField = (key: string, value: string) => {
  if (DATE_FIELDS.has(key)) return (value || '').slice(0, 10);
  return normalizeSum(value);
};

const sameFields = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (normalizeField(key, a[key] || '') !== normalizeField(key, b[key] || '')) {
      return false;
    }
  }
  return true;
};

/** Compares the fields that matter, ignoring formatting differences like "125.5" vs "125.50". */
export const samePlain = (a: PlainPayload, b: PlainPayload) => {
  if (isBundlePayload(a) || isBundlePayload(b)) {
    if (!isBundlePayload(a) || !isBundlePayload(b) || a.kind !== b.kind) return false;
    return sameFields(a.fields, b.fields);
  }
  return (
    normalizeSum(a.sum) === normalizeSum(b.sum) &&
    (a.dt || '').slice(0, 10) === (b.dt || '').slice(0, 10) &&
    (a.dsc || '').trim() === (b.dsc || '').trim() &&
    (a.cat || '') === (b.cat || '')
  );
};
