import { useEffect, useMemo, useState } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useEncryptionState } from '../../../../crypto/encryptionState';
import { getAiItems, type AiItem } from '../../../../ai/data';
import {
  getDataProviderKind,
  type FamilyCategoryMemberTotal,
  type Household,
} from '../../../../data';
import { sharedTotalsFromItems, totalsToAiItems } from './familyTotals';

export type FamilyTotalsSource =
  | 'rpc'
  | 'personal_fallback'
  | 'encryption_local'
  | 'none';

type SharedSnapshot = {
  household: Household | null;
  familyItems: AiItem[];
  memberTotals: FamilyCategoryMemberTotal[];
  incomeItems: AiItem[];
  incomeMemberTotals: FamilyCategoryMemberTotal[];
  totalsSource: FamilyTotalsSource;
  rpcOk: boolean;
};

/** Module cache so monthly + all-time charts share one household/RPC fetch. */
let cached: SharedSnapshot | null = null;
let cachedKey: unknown = null;
let inFlight: Promise<SharedSnapshot> | null = null;
let inFlightKey: unknown = null;

const loadFamilySharedTotals = async (
  api: NonNullable<ReturnType<typeof useApiClient>>,
  personalItems: AiItem[],
  encryptionOn: boolean
): Promise<SharedSnapshot> => {
  const house = await api.getHousehold();
  if (!house.success || !house.data) {
    return {
      household: null,
      familyItems: [],
      memberTotals: [],
      incomeItems: [],
      incomeMemberTotals: [],
      totalsSource: 'none',
      rpcOk: false,
    };
  }

  const household = house.data;
  const shared = new Set(
    (household.shared_categories || []).map((id) => String(id))
  );
  const local = sharedTotalsFromItems(personalItems, shared);

  // Encrypted rows have blank server amount/category — RPC cannot sum partners.
  if (encryptionOn) {
    return {
      household,
      familyItems: local,
      memberTotals: [],
      incomeItems: [],
      incomeMemberTotals: [],
      totalsSource: 'encryption_local',
      rpcOk: false,
    };
  }

  const [totalsResult, memberResult, incomeResult, incomeMemberResult] =
    await Promise.all([
      api.listFamilyCategoryTotals(),
      api.listFamilyCategoryMemberTotals(),
      api.listFamilyIncomeTotals(),
      api.listFamilyIncomeMemberTotals(),
    ]);

  const rpcOk = !!(totalsResult.success && totalsResult.data);
  const rpcRows = totalsResult.success ? totalsResult.data || [] : [];
  const hasRpcSpend = rpcRows.some((row) => Number(row.total) > 0);

  let familyItems: AiItem[];
  let totalsSource: FamilyTotalsSource;

  if (rpcOk && hasRpcSpend) {
    familyItems = totalsToAiItems(rpcRows);
    totalsSource = 'rpc';
  } else if (rpcOk && rpcRows.length === 0 && local.length === 0) {
    // Truly empty household spend.
    familyItems = [];
    totalsSource = 'rpc';
  } else if (rpcOk && !hasRpcSpend && local.length > 0) {
    // Empty/zero RPC while local has spend — do not silently label as family.
    familyItems = local;
    totalsSource = 'personal_fallback';
  } else if (!rpcOk) {
    familyItems = local;
    totalsSource = 'personal_fallback';
  } else {
    familyItems = totalsToAiItems(rpcRows);
    totalsSource = 'rpc';
  }

  const memberTotals =
    memberResult.success && memberResult.data && totalsSource === 'rpc'
      ? memberResult.data
      : [];

  const incomeItems =
    incomeResult.success && incomeResult.data
      ? totalsToAiItems(incomeResult.data).map((item) => ({
          ...item,
          kind: 'income' as const,
        }))
      : [];

  const incomeMemberTotals =
    incomeMemberResult.success && incomeMemberResult.data
      ? incomeMemberResult.data
      : [];

  return {
    household,
    familyItems,
    memberTotals,
    incomeItems,
    incomeMemberTotals,
    totalsSource,
    rpcOk,
  };
};

export type UseFamilySharedTotalsResult = {
  household: Household | null;
  familyItems: AiItem[];
  memberTotals: FamilyCategoryMemberTotal[];
  incomeItems: AiItem[];
  incomeMemberTotals: FamilyCategoryMemberTotal[];
  sharedCategoryIds: Set<string>;
  loading: boolean;
  totalsSource: FamilyTotalsSource;
  encryptionOn: boolean;
};

/**
 * Household + family shared category totals (RPC with explicit personal fallback).
 * Safe to call from multiple chart components — fetch is deduped.
 */
export const useFamilySharedTotals = (): UseFamilySharedTotalsResult => {
  const { data } = useExpenseData();
  const api = useApiClient();
  const encryption = useEncryptionState();
  const encryptionOn = encryption.status === 'on';

  const [household, setHousehold] = useState<Household | null>(
    cached?.household ?? null
  );
  const [familyItems, setFamilyItems] = useState<AiItem[]>(
    cached?.familyItems ?? []
  );
  const [memberTotals, setMemberTotals] = useState<FamilyCategoryMemberTotal[]>(
    cached?.memberTotals ?? []
  );
  const [incomeItems, setIncomeItems] = useState<AiItem[]>(
    cached?.incomeItems ?? []
  );
  const [incomeMemberTotals, setIncomeMemberTotals] = useState<
    FamilyCategoryMemberTotal[]
  >(cached?.incomeMemberTotals ?? []);
  const [totalsSource, setTotalsSource] = useState<FamilyTotalsSource>(
    cached?.totalsSource ?? 'none'
  );
  const [loading, setLoading] = useState(!cached);

  const personalItems = useMemo(
    () => getAiItems(data.raw || []),
    [data.raw]
  );
  const cacheKey = `${encryptionOn ? 'enc' : 'plain'}:${String(
    (data.raw as unknown[] | undefined)?.length ?? 0
  )}:${data.raw}`;

  useEffect(() => {
    if (getDataProviderKind() !== 'supabase' || !api) {
      setHousehold(null);
      setFamilyItems([]);
      setMemberTotals([]);
      setIncomeItems([]);
      setIncomeMemberTotals([]);
      setTotalsSource('none');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const apply = (snapshot: SharedSnapshot) => {
      if (cancelled) return;
      setHousehold(snapshot.household);
      setFamilyItems(snapshot.familyItems);
      setMemberTotals(snapshot.memberTotals);
      setIncomeItems(snapshot.incomeItems);
      setIncomeMemberTotals(snapshot.incomeMemberTotals);
      setTotalsSource(snapshot.totalsSource);
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
      promise = loadFamilySharedTotals(api, personalItems, encryptionOn)
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
  }, [api, personalItems, cacheKey, encryptionOn]);

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
    incomeItems,
    incomeMemberTotals,
    sharedCategoryIds,
    loading,
    totalsSource,
    encryptionOn,
  };
};

/** Clear module cache (e.g. after household membership changes). */
export const clearFamilySharedTotalsCache = (): void => {
  cached = null;
  cachedKey = null;
  inFlight = null;
  inFlightKey = null;
};
