/**
 * AI tools for the Net Worth feature (read-only). Only offered when Net Worth
 * is enabled; the emergency fund counts as an asset only when Goals is on too.
 */
import type { NetWorthSnapshot } from '@features/netWorth/model';
import type { GeminiFunctionDeclaration } from '../client';
import { localToday, round } from '../data';

export interface NetWorthToolContext {
  netWorthEnabled: boolean;
  /** Snapshot built with the emergency fund only when Goals is enabled. */
  netWorth: NetWorthSnapshot | null;
  goalsEnabled: boolean;
  /** False while loans are still loading, so liabilities may be incomplete. */
  loansLoaded: boolean;
  shareDescriptions: boolean;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const ASSET_COLUMNS = 'name|kind|value';
const LOAN_COLUMNS = 'name|status|remainingPrincipal|remainingInterest|totalLeft';

const FORMULA =
  'netWorth = assets - liabilities. assets = custom assets (+ emergency fund when Goals is enabled). liabilities = remaining principal + remaining interest of every unfinished loan.';

/** Asset names are free text the user typed, so they follow the description-sharing setting. */
const assetName = (name: string, kind: string, share: boolean) =>
  share ? name.replace(/\|/g, '/').replace(/\s+/g, ' ') : kind;

const getNetWorth = (ctx: NetWorthToolContext, _args: Args): ToolResult => {
  if (!ctx.netWorthEnabled || !ctx.netWorth) {
    return { error: 'Net worth is disabled' };
  }
  const snapshot = ctx.netWorth;
  const openLoans = snapshot.loans.filter((loan) => loan.remaining > 0);

  return {
    netWorth: snapshot.netWorth,
    assets: snapshot.assets,
    liabilities: snapshot.liabilities,
    emergencyFundIncluded: ctx.goalsEnabled,
    emergencyFund: ctx.goalsEnabled ? snapshot.emergencyFund : null,
    customAssetsTotal: snapshot.customAssetsTotal,
    customAssetCount: snapshot.customAssets.length,
    assetColumns: ASSET_COLUMNS,
    assetRows: snapshot.customAssets
      .map(
        (asset) =>
          `${assetName(asset.name, asset.kind, ctx.shareDescriptions)}|${asset.kind}|${round(asset.value)}`
      )
      .join('\n'),
    openLoanCount: openLoans.length,
    loanColumns: LOAN_COLUMNS,
    loanRows: openLoans
      .map(
        (loan) =>
          `${loan.name.replace(/\|/g, '/')}|${loan.status}|${round(loan.principal)}|${round(loan.interest)}|${round(loan.remaining)}`
      )
      .join('\n'),
    liabilitiesComplete: ctx.loansLoaded,
    formula: FORMULA,
    asOf: localToday(),
  };
};

/** Short DATA SUMMARY block when Net Worth is enabled. */
export const formatNetWorthSummary = (
  snapshot: NetWorthSnapshot,
  options: { goalsEnabled: boolean; loansLoaded: boolean }
): string => {
  const parts = [
    `net worth ${round(snapshot.netWorth)}`,
    `assets ${round(snapshot.assets)} (${
      options.goalsEnabled
        ? `emergency fund ${round(snapshot.emergencyFund)}, `
        : 'emergency fund not counted because Goals is off, '
    }custom assets ${round(snapshot.customAssetsTotal)} in ${snapshot.customAssets.length} item${snapshot.customAssets.length === 1 ? '' : 's'})`,
    `liabilities ${round(snapshot.liabilities)} (remaining loan principal + interest)`,
  ];
  const lines = [
    'NET WORTH',
    `${parts.join('; ')}.`,
  ];
  if (!options.loansLoaded) {
    lines.push('Loans are still loading, so liabilities may be incomplete.');
  }
  lines.push(
    'For the asset and loan breakdown, call get_net_worth. It matches the Net Worth page.'
  );
  return lines.join('\n');
};

export const netWorthToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'get_net_worth',
    description:
      'Net worth overview: net worth, total assets, total liabilities, the emergency fund (only when Goals is enabled), custom assets (property, vehicle, other) and the remaining principal and interest per open loan. Prefer this for "what is my net worth", "what do I own vs owe" or asset/liability questions.',
    parameters: { type: 'object', properties: {} },
  },
];

export const netWorthToolExecutors: Record<
  string,
  (ctx: NetWorthToolContext, args: Args) => ToolResult
> = {
  get_net_worth: getNetWorth,
};

export const NET_WORTH_TOOL_LABELS: Record<string, string> = {
  get_net_worth: 'Checking your net worth',
};
