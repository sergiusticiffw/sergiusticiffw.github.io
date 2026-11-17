import { useEffect, useMemo, useState } from 'react';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useEncryptionState } from '../../../../crypto/encryptionState';
import {
  getDataProviderKind,
  type FamilyCategoryDailyTotal,
  type Household,
} from '../../../../data';
import { partnerDayTotal, partnerDaysWithSpend } from './familyTotals';
import type { FamilyTotalsSource } from './useFamilySharedTotals';

type DailySnapshot = {
  household: Household | null;
  rows: FamilyCategoryDailyTotal[];
  sharedCategoryIds: Set<string>;
  totalsSource: FamilyTotalsSource;
};

const cache = new Map<string, DailySnapshot>();
const inFlight = new Map<string, Promise<DailySnapshot>>();

/** Drop cached daily totals (e.g. after migration / logout). */
export const clearFamilyDailyTotalsCache = (): void => {
  cache.clear();
  inFlight.clear();
};

const emptySnapshot = (): DailySnapshot => ({
  household: null,
  rows: [],
  sharedCategoryIds: new Set(),
  totalsSource: 'none',
});

const loadDaily = async (
  api: NonNullable<ReturnType<typeof useApiClient>>,
  monthKey: string,
  encryptionOn: boolean
): Promise<DailySnapshot> => {
  const house = await api.getHousehold();
  if (!house.success || !house.data) return emptySnapshot();

  const household = house.data;
  const sharedCategoryIds = new Set(
    (household.shared_categories || []).map((c) => String(c))
  );

  if (encryptionOn) {
    return {
      household,
      rows: [],
      sharedCategoryIds,
      totalsSource: 'encryption_local',
    };
  }

  const result = await api.listFamilyCategoryDailyTotals(monthKey);
  if (result.success && result.data && result.data.length > 0) {
    return {
      household,
      rows: result.data,
      sharedCategoryIds,
      totalsSource: 'rpc',
    };
  }

  if (result.success) {
    return {
      household,
      rows: [],
      sharedCategoryIds,
      totalsSource: sharedCategoryIds.size > 0 ? 'rpc' : 'none',
    };
  }

  return {
    household,
    rows: [],
    sharedCategoryIds,
    totalsSource: 'personal_fallback',
  };
};

export type UseFamilyDailyTotalsResult = {
  household: Household | null;
  rows: FamilyCategoryDailyTotal[];
  sharedCategoryIds: Set<string>;
  totalsSource: FamilyTotalsSource;
  loading: boolean;
  /** Days where other members spent (excludes current user). */
  partnerDaysWithSpend: (myUid: string) => Set<string>;
  partnerDayTotal: (dayKey: string, myUid: string) => number;
};

/**
 * Day×category×member shared aggregates for one calendar month (YYYY-MM).
 * UI filters out the current user to show other household members only.
 */
export const useFamilyDailyTotals = (
  monthKey: string | null
): UseFamilyDailyTotalsResult => {
  const api = useApiClient();
  const encryption = useEncryptionState();
  const encryptionOn = encryption.status === 'on';

  const cacheKey = monthKey
    ? `${monthKey}:${encryptionOn ? 'enc' : 'plain'}`
    : '';

  const [snapshot, setSnapshot] = useState<DailySnapshot>(() =>
    cacheKey && cache.has(cacheKey) ? cache.get(cacheKey)! : emptySnapshot()
  );
  const [loading, setLoading] = useState(
    () => !!(monthKey && !cache.has(cacheKey))
  );

  useEffect(() => {
    if (
      !monthKey ||
      monthKey.length !== 7 ||
      getDataProviderKind() !== 'supabase' ||
      !api
    ) {
      setSnapshot(emptySnapshot());
      setLoading(false);
      return;
    }

    let cancelled = false;
    const key = `${monthKey}:${encryptionOn ? 'enc' : 'plain'}`;

    if (cache.has(key)) {
      setSnapshot(cache.get(key)!);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let promise = inFlight.get(key);
    if (!promise) {
      promise = loadDaily(api, monthKey, encryptionOn).then((next) => {
        cache.set(key, next);
        inFlight.delete(key);
        return next;
      });
      inFlight.set(key, promise);
    }

    void promise.then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [api, monthKey, encryptionOn]);

  const partnerDaysFn = useMemo(
    () => (myUid: string) => partnerDaysWithSpend(snapshot.rows, myUid),
    [snapshot.rows]
  );

  const partnerTotalFn = useMemo(
    () => (dayKey: string, myUid: string) =>
      partnerDayTotal(snapshot.rows, dayKey, myUid),
    [snapshot.rows]
  );

  return {
    household: snapshot.household,
    rows: snapshot.rows,
    sharedCategoryIds: snapshot.sharedCategoryIds,
    totalsSource: snapshot.totalsSource,
    loading,
    partnerDaysWithSpend: partnerDaysFn,
    partnerDayTotal: partnerTotalFn,
  };
};
