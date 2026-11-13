import { useEffect, useMemo, useState } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useApiClient } from '@shared/hooks/useApiClient';
import { getAiItems, type AiItem } from '../../../../ai/data';
import {
  getDataProviderKind,
  type FamilyCategoryMemberTotal,
  type Household,
} from '../../../../data';
import { sharedTotalsFromItems, totalsToAiItems } from './familyTotals';

type SharedSnapshot = {
  household: Household | null;
  familyItems: AiItem[];
  memberTotals: FamilyCategoryMemberTotal[];
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
    return { household: null, familyItems: [], memberTotals: [] };
  }

  const household = house.data;
  const shared = new Set(
    (household.shared_categories || []).map((id) => String(id))
  );
  const local = sharedTotalsFromItems(personalItems, shared);

  const [totalsResult, memberResult] = await Promise.all([
    api.listFamilyCategoryTotals(),
    api.listFamilyCategoryMemberTotals(),
  ]);

  const familyItems =
    totalsResult.success && totalsResult.data && totalsResult.data.length > 0
      ? totalsToAiItems(totalsResult.data)
      : local;

  const memberTotals =
    memberResult.success && memberResult.data ? memberResult.data : [];

  return { household, familyItems, memberTotals };
};

export type UseFamilySharedTotalsResult = {
  household: Household | null;
  familyItems: AiItem[];
  memberTotals: FamilyCategoryMemberTotal[];
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
  const [memberTotals, setMemberTotals] = useState<FamilyCategoryMemberTotal[]>(
    cached?.memberTotals ?? []
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
      setMemberTotals([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const apply = (snapshot: SharedSnapshot) => {
      if (cancelled) return;
      setHousehold(snapshot.household);
      setFamilyItems(snapshot.familyItems);
      setMemberTotals(snapshot.memberTotals);
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

  return {
    household,
    familyItems,
    memberTotals,
    sharedCategoryIds,
    loading,
  };
};
