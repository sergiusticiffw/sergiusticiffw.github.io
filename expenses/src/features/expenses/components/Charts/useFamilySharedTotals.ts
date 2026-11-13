import { useEffect, useMemo, useState } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useApiClient } from '@shared/hooks/useApiClient';
import { getAiItems, type AiItem } from '../../../../ai/data';
import {
  getDataProviderKind,
  type Household,
} from '../../../../data';
import { sharedTotalsFromItems, totalsToAiItems } from './familyTotals';

type SharedSnapshot = {
  household: Household | null;
  familyItems: AiItem[];
};

/** Module cache so monthly + all-time charts share one household/RPC fetch. */
let cached: SharedSnapshot | null = null;
let cachedKey: unknown = null;
let inFlight: Promise<SharedSnapshot> | null = null;
let inFlightKey: unknown = null;

const loadFamilySharedTotals = async (
  api: NonNullable<ReturnType<typeof useApiClient>>,
  personalItems: AiItem[]
): Promise<SharedSnapshot> => {
  const house = await api.getHousehold();
  if (!house.success || !house.data) {
    return { household: null, familyItems: [] };
  }

  const household = house.data;
  const shared = new Set(
    (household.shared_categories || []).map((id) => String(id))
  );
  const local = sharedTotalsFromItems(personalItems, shared);

  const result = await api.listFamilyCategoryTotals();
  if (result.success && result.data && result.data.length > 0) {
    return { household, familyItems: totalsToAiItems(result.data) };
  }

  return { household, familyItems: local };
};

export type UseFamilySharedTotalsResult = {
  household: Household | null;
  familyItems: AiItem[];
  sharedCategoryIds: Set<string>;
  loading: boolean;
};

/**
 * Household + family shared category totals (RPC with local fallback).
 * Safe to call from multiple chart components — fetch is deduped.
 */
export const useFamilySharedTotals = (): UseFamilySharedTotalsResult => {
  const { data } = useExpenseData();
  const api = useApiClient();
  const [household, setHousehold] = useState<Household | null>(
    cached?.household ?? null
  );
  const [familyItems, setFamilyItems] = useState<AiItem[]>(
    cached?.familyItems ?? []
  );
  const [loading, setLoading] = useState(!cached);

  const personalItems = useMemo(
    () => getAiItems(data.raw || []),
    [data.raw]
  );
  const cacheKey = data.raw;

  useEffect(() => {
    if (getDataProviderKind() !== 'supabase' || !api) {
      setHousehold(null);
      setFamilyItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const apply = (snapshot: SharedSnapshot) => {
      if (cancelled) return;
      setHousehold(snapshot.household);
      setFamilyItems(snapshot.familyItems);
      setLoading(false);
    };

    if (cached && cachedKey === cacheKey) {
      apply(cached);
    } else {
      setLoading(true);
    }

    let promise = inFlight;
    if (!promise || inFlightKey !== cacheKey) {
      inFlightKey = cacheKey;
      promise = loadFamilySharedTotals(api, personalItems)
        .then((snapshot) => {
          if (inFlightKey === cacheKey) {
            cached = snapshot;
            cachedKey = cacheKey;
          }
          return snapshot;
        })
        .finally(() => {
          if (inFlightKey === cacheKey) {
            inFlight = null;
          }
        });
      inFlight = promise;
    }

    promise.then(apply);

    return () => {
      cancelled = true;
    };
  }, [api, personalItems, cacheKey]);

  const sharedCategoryIds = useMemo(
    () =>
      new Set(
        (household?.shared_categories || []).map((id) => String(id))
      ),
    [household]
  );

  return { household, familyItems, sharedCategoryIds, loading };
};
