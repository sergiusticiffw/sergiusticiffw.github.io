import { getApiBaseUrl } from '@shared/utils/apiBase';
import {
  isIndexedDBAvailable,
  isOnline,
  saveExpenseLocally,
} from '@shared/utils/indexedDB';
import { saveOffline, updateUILocally } from '@shared/utils/offlineAPI';
import { logger } from '@shared/utils/logger';
import { TransactionOrIncomeItem } from '@shared/type/types';
import type { VoiceMoneyEntry } from '../../../ai/parseVoiceEntry';
import { isWriteBlocked } from '../../../crypto/encryptionState';
import { encodeNodeBody } from '../../../crypto/nodeCodec';

const createUrl = () =>
  `${getApiBaseUrl().replace(/\/+$/, '')}/node?_format=json`.replace(/([^:]\/)\/+/g, '$1');

const nodeFor = (entry: VoiceMoneyEntry) => ({
  type: entry.kind === 'income' ? 'incomes' : 'transaction',
  title: [entry.date],
  field_amount: [entry.amount],
  field_date: [entry.date],
  field_description: [entry.description],
  ...(entry.kind === 'expense' ? { field_category: [entry.category] } : {}),
});

const itemFor = (entry: VoiceMoneyEntry, id?: string): TransactionOrIncomeItem => ({
  id: id || '',
  dt: entry.date,
  sum: entry.amount,
  type: entry.kind === 'income' ? 'incomes' : 'transaction',
  cat: entry.kind === 'expense' ? entry.category : undefined,
  dsc: entry.description,
  cr: Date.now(),
});

const saveOne = async (entry: VoiceMoneyEntry, token: string, url: string) => {
  if (isWriteBlocked()) {
    throw new Error('write-blocked');
  }
  const node = nodeFor(entry);
  const entityType = entry.kind === 'income' ? 'income' : 'expense';
  const encoded = await encodeNodeBody(node);

  const persistOffline = async () => {
    await saveOffline(itemFor(entry), node, 'add', entityType, url, 'POST');
    return true;
  };

  if (!isOnline() || !isIndexedDBAvailable() || encoded.kind === 'hold') {
    if (!isIndexedDBAvailable()) {
      throw new Error('Local storage is not available');
    }
    return persistOffline();
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': `Bearer ${token}`,
      }),
      body: JSON.stringify(encoded.body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const serverId = data?.nid?.[0]?.value?.toString() || data?.nid?.toString();
    if (!serverId) throw new Error('No ID returned from server');
    await saveExpenseLocally(itemFor(entry, serverId), true);
    return false;
  } catch (error) {
    logger.error('Voice entry fell back to offline save:', error);
    return persistOffline();
  }
};

/** Creates expense/income nodes the same way the forms do. Returns whether any row was stored offline. */
export async function saveMoneyEntries(
  entries: VoiceMoneyEntry[],
  token: string,
  dataDispatch: (action: any) => void
): Promise<{ offline: boolean }> {
  const url = createUrl();
  let offline = false;
  for (const entry of entries) {
    if (await saveOne(entry, token, url)) offline = true;
  }
  await updateUILocally(dataDispatch);
  return { offline };
}
