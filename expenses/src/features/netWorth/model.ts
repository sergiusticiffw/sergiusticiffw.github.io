export type LoanLiability = {
  id: string;
  name: string;
  /** Remaining principal still owed. */
  principal: number;
  /** Remaining interest still to pay (scheduled + accrued unpaid). */
  interest: number;
  /** principal + interest (what still costs you). */
  remaining: number;
  status: 'active' | 'pending' | 'completed';
};

export type NetWorthAssetKind = 'cash' | 'property' | 'vehicle' | 'other';

export type NetWorthAsset = {
  id: string;
  name: string;
  value: number;
  kind: NetWorthAssetKind;
};

export type NetWorthAssetsState = {
  v: 1;
  cash: number;
  items: NetWorthAsset[];
  updatedAt: string;
};

export type NetWorthSnapshot = {
  /** Emergency fund + custom assets. */
  assets: number;
  emergencyFund: number;
  /** @deprecated Kept for snapshot shape; always 0 in UI. */
  cash: number;
  customAssets: NetWorthAsset[];
  customAssetsTotal: number;
  /** Sum of remaining loan principal + interest still to pay. */
  liabilities: number;
  loans: LoanLiability[];
  /** assets − liabilities */
  netWorth: number;
};

/** Whole currency units only — no cents/bani. */
const roundWhole = (value: number) => Math.round(value);

const newId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const emptyNetWorthAssets = (): NetWorthAssetsState => ({
  v: 1,
  cash: 0,
  items: [],
  updatedAt: new Date().toISOString(),
});

export const isValidAssetKind = (value: unknown): value is NetWorthAssetKind =>
  value === 'cash' ||
  value === 'property' ||
  value === 'vehicle' ||
  value === 'other';

export const createNetWorthAsset = (input: {
  name: string;
  value: number;
  kind?: NetWorthAssetKind;
}): NetWorthAsset | null => {
  const name = String(input.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const value = Number(input.value);
  if (!name || !Number.isFinite(value) || value < 0) return null;
  return {
    id: newId(),
    name,
    value: roundWhole(value),
    kind: isValidAssetKind(input.kind) ? input.kind : 'other',
  };
};

export const sanitizeNetWorthAssets = (value: unknown): NetWorthAssetsState => {
  if (!value || typeof value !== 'object') return emptyNetWorthAssets();
  const raw = value as Partial<NetWorthAssetsState> & { cash?: unknown };
  const cashRaw = Number(raw.cash);
  const cash = Number.isFinite(cashRaw) ? roundWhole(cashRaw) : 0;
  const items: NetWorthAsset[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.items)) {
    for (const row of raw.items) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Partial<NetWorthAsset>;
      const name = String(item.name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const amount = Number(item.value);
      if (!name || !Number.isFinite(amount) || amount < 0) continue;
      const id =
        typeof item.id === 'string' && item.id ? item.id : newId();
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        name,
        value: roundWhole(amount),
        kind: isValidAssetKind(item.kind) ? item.kind : 'other',
      });
    }
  }
  return {
    v: 1,
    cash,
    items,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
};

export const buildNetWorth = (input: {
  emergencyFund: number;
  cash: number;
  customAssets?: NetWorthAsset[];
  loans: LoanLiability[];
}): NetWorthSnapshot => {
  const emergencyFund = roundWhole(
    Math.max(0, Number(input.emergencyFund) || 0)
  );
  const cash = roundWhole(Number(input.cash) || 0);
  const customAssets = (input.customAssets || [])
    .map((asset) => ({
      ...asset,
      value: roundWhole(Math.max(0, Number(asset.value) || 0)),
    }))
    .filter((asset) => asset.name);
  const customAssetsTotal = roundWhole(
    customAssets.reduce((sum, asset) => sum + asset.value, 0)
  );
  const loans = input.loans
    .map((loan) => {
      const principal = roundWhole(Math.max(0, Number(loan.principal) || 0));
      const interest = roundWhole(Math.max(0, Number(loan.interest) || 0));
      return {
        ...loan,
        principal,
        interest,
        remaining: roundWhole(principal + interest),
      };
    })
    .filter((loan) => loan.status !== 'completed' || loan.remaining > 0);
  const liabilities = roundWhole(
    loans.reduce((sum, loan) => sum + loan.remaining, 0)
  );
  const assets = roundWhole(emergencyFund + cash + customAssetsTotal);
  return {
    assets,
    emergencyFund,
    cash,
    customAssets,
    customAssetsTotal,
    liabilities,
    loans,
    netWorth: roundWhole(assets - liabilities),
  };
};
