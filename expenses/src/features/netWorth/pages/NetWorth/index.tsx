import React, { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiHome,
  FiPieChart,
  FiPlus,
  FiShield,
  FiTrash2,
  FiTruck,
} from 'react-icons/fi';
import { useLoan } from '@stores/loanStore';
import { useEmergencyFund } from '@features/goals/store';
import { useGoalsEnabled, useSettingsCurrency } from '@stores/settingsStore';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import {
  FormField,
  Loader,
  LoadingSpinner,
  PageHeader,
} from '@shared/components/Common';
import VaulDrawer from '@shared/components/VaulDrawer';
import {
  BTN_SUBMIT_CLASS,
  PAGE_CONTAINER_CLASS,
} from '@shared/utils/layoutClasses';
import { formatNumber } from '@shared/utils/utils';
import { notificationType } from '@shared/utils/constants';
import { computeLoanLiabilities } from '../../loanLiabilities';
import {
  NetWorthAsset,
  NetWorthAssetKind,
  buildNetWorth,
} from '../../model';
import {
  addNetWorthAsset,
  getNetWorthAssets,
  removeNetWorthAsset,
  updateNetWorthAsset,
  useNetWorthAssets,
} from '../../assetsStore';
import { persistNetWorthToSupabase } from '../../../profile/preferencesSync';
import { getDataProviderKind } from '../../../../data';

type AssetDraft = {
  id?: string;
  name: string;
  value: string;
  kind: Exclude<NetWorthAssetKind, 'cash'>;
};

const emptyDraft = (): AssetDraft => ({
  name: '',
  value: '',
  kind: 'other',
});

const kindIcon = (kind: NetWorthAssetKind) => {
  if (kind === 'property') return FiHome;
  if (kind === 'vehicle') return FiTruck;
  return FiDollarSign;
};

const NetWorth = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const fund = useEmergencyFund();
  const assetsState = useNetWorthAssets();
  const { data, dataDispatch } = useLoan();
  const apiClient = useApiClient();
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(emptyDraft);
  const [savingAsset, setSavingAsset] = useState(false);

  useEffect(() => {
    if (!data.loans && apiClient) {
      fetchLoansService(apiClient, dataDispatch);
    }
  }, [data.loans, apiClient, dataDispatch]);

  const snapshot = useMemo(
    () =>
      buildNetWorth({
        emergencyFund: fund.balance,
        cash: 0,
        customAssets: assetsState.items,
        loans: computeLoanLiabilities(data.loans, data.payments),
      }),
    [fund.balance, assetsState.items, data.loans, data.payments]
  );

  const kindLabel = (kind: NetWorthAssetKind) => {
    if (kind === 'property') return t('netWorth.kindProperty');
    if (kind === 'vehicle') return t('netWorth.kindVehicle');
    return t('netWorth.kindOther');
  };

  const openNewAsset = (preset?: Partial<AssetDraft>) => {
    setAssetDraft({
      ...emptyDraft(),
      ...preset,
      name: preset?.name || '',
      value: preset?.value || '',
      kind: preset?.kind || 'other',
    });
    setAssetOpen(true);
  };

  const openEditAsset = (asset: NetWorthAsset) => {
    setAssetDraft({
      id: asset.id,
      name: asset.name,
      value: String(asset.value),
      kind: asset.kind === 'cash' ? 'other' : asset.kind,
    });
    setAssetOpen(true);
  };

  const persistAssetsToCloud = async () => {
    if (!navigator.onLine) return false;
    if (getDataProviderKind() !== 'supabase') return false;
    return persistNetWorthToSupabase({
      assets: getNetWorthAssets() as unknown as Record<string, unknown>,
    });
  };

  const saveAsset = async () => {
    const value = parseFloat(assetDraft.value.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      showNotification(t('netWorth.assetInvalid'), notificationType.ERROR);
      return;
    }
    const name = assetDraft.name.trim();
    if (!name) {
      showNotification(t('netWorth.assetNameRequired'), notificationType.ERROR);
      return;
    }
    setSavingAsset(true);
    try {
      if (assetDraft.id) {
        const updated = updateNetWorthAsset(assetDraft.id, {
          name,
          value,
          kind: assetDraft.kind,
        });
        if (!updated) {
          showNotification(t('netWorth.assetInvalid'), notificationType.ERROR);
          return;
        }
      } else {
        const created = addNetWorthAsset({
          name,
          value,
          kind: assetDraft.kind,
        });
        if (!created) {
          showNotification(t('netWorth.assetInvalid'), notificationType.ERROR);
          return;
        }
      }
      const synced = await persistAssetsToCloud();
      showNotification(
        synced ? t('netWorth.assetSaved') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
      setAssetOpen(false);
      setAssetDraft(emptyDraft());
    } catch {
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setSavingAsset(false);
    }
  };

  const deleteAsset = async () => {
    if (!assetDraft.id) return;
    removeNetWorthAsset(assetDraft.id);
    setAssetOpen(false);
    setAssetDraft(emptyDraft());
    const synced = await persistAssetsToCloud();
    showNotification(
      synced ? t('netWorth.assetDeleted') : t('goals.savedOffline'),
      notificationType.SUCCESS
    );
  };

  const loading = data.loading && !data.loans;

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader
        title={t('netWorth.title')}
        subtitle={t('netWorth.subtitle')}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4 pb-8 max-w-[600px] mx-auto w-full">
          {/* Hero figure */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-5 py-6 text-center shadow-[0_8px_28px_rgba(0,0,0,0.24)]">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-app-muted">
              {t('netWorth.netWorth')}
            </p>
            <p
              className={`m-0 mt-2 font-extrabold tabular-nums tracking-tight leading-none ${
                snapshot.netWorth >= 0
                  ? 'text-app-primary'
                  : 'text-[var(--color-expense)]'
              }`}
              style={{ fontSize: 'clamp(2rem, 9vw, 2.75rem)' }}
            >
              {formatNumber(snapshot.netWorth)}
            </p>
            <p className="m-0 mt-2 text-sm text-app-muted">{currency}</p>
            <p className="m-0 mt-3 text-xs text-app-muted leading-relaxed">
              {t('netWorth.formula')}
            </p>
          </div>

          {/* Assets */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
              <h2 className="m-0 text-sm font-semibold text-app-primary inline-flex items-center gap-2">
                <FiDollarSign className="text-[var(--color-income)]" />
                {t('netWorth.assets')}
              </h2>
              <span className="text-sm font-bold tabular-nums text-[var(--color-income)]">
                {formatNumber(snapshot.assets)} {currency}
              </span>
            </div>
            <ul className="m-0 p-0 list-none">
              <li
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  snapshot.customAssets.length > 0
                    ? 'border-b border-white/[0.04]'
                    : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="m-0 text-sm text-app-primary">
                    {t('netWorth.emergencyFund')}
                  </p>
                  {!goalsEnabled && (
                    <p className="m-0 mt-0.5 text-[11px] text-app-muted">
                      {t('netWorth.goalsDisabledHint')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-app-secondary">
                    {formatNumber(snapshot.emergencyFund)}
                  </span>
                  {goalsEnabled && (
                    <Link
                      to="/expenses/goals"
                      className="p-1.5 text-app-muted hover:text-app-primary"
                      aria-label={t('netWorth.openGoals')}
                    >
                      <FiShield size={15} />
                    </Link>
                  )}
                </div>
              </li>
              {snapshot.customAssets.map((asset, index, list) => {
                const Icon = kindIcon(asset.kind);
                return (
                  <li
                    key={asset.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      index < list.length - 1
                        ? 'border-b border-white/[0.04]'
                        : ''
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2.5">
                      <Icon
                        className="mt-0.5 shrink-0 text-app-muted"
                        size={15}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="m-0 text-sm text-app-primary truncate">
                          {asset.name}
                        </p>
                        <p className="m-0 mt-0.5 text-[11px] text-app-muted">
                          {kindLabel(asset.kind)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-app-secondary">
                        {formatNumber(asset.value)}
                      </span>
                      <button
                        type="button"
                        className="p-1.5 border-none bg-transparent text-app-muted hover:text-app-primary cursor-pointer"
                        onClick={() => openEditAsset(asset)}
                        aria-label={t('netWorth.editAsset')}
                      >
                        <FiEdit2 size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-3 border-t border-white/[0.06] flex flex-col gap-2">
              <p className="m-0 text-[11px] text-app-muted">
                {t('netWorth.addAssetHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-app-primary cursor-pointer hover:bg-white/[0.08]"
                  onClick={() =>
                    openNewAsset({
                      kind: 'property',
                      name: t('netWorth.presetApartment'),
                    })
                  }
                >
                  <FiHome size={13} aria-hidden />
                  {t('netWorth.presetApartment')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-app-primary cursor-pointer hover:bg-white/[0.08]"
                  onClick={() =>
                    openNewAsset({
                      kind: 'vehicle',
                      name: t('netWorth.presetCar'),
                    })
                  }
                >
                  <FiTruck size={13} aria-hidden />
                  {t('netWorth.presetCar')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-app-primary cursor-pointer hover:bg-white/[0.08]"
                  onClick={() => openNewAsset()}
                >
                  <FiPlus size={13} aria-hidden />
                  {t('netWorth.addAsset')}
                </button>
              </div>
            </div>
          </section>

          {/* Liabilities */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
              <h2 className="m-0 text-sm font-semibold text-app-primary inline-flex items-center gap-2">
                <FiCreditCard className="text-[var(--color-expense)]" />
                {t('netWorth.liabilities')}
              </h2>
              <span className="text-sm font-bold tabular-nums text-[var(--color-expense)]">
                {formatNumber(snapshot.liabilities)} {currency}
              </span>
            </div>
            {snapshot.loans.filter((loan) => loan.remaining > 0).length ===
            0 ? (
              <p className="m-0 px-4 py-3 text-sm text-app-muted">
                {t('netWorth.noLoans')}
              </p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {snapshot.loans
                  .filter((loan) => loan.remaining > 0)
                  .map((loan, index, list) => (
                    <li
                      key={loan.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        index < list.length - 1
                          ? 'border-b border-white/[0.04]'
                          : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="m-0 text-sm text-app-primary truncate">
                          {loan.name}
                        </p>
                        <p className="m-0 mt-0.5 text-[11px] text-app-muted">
                          {loan.status === 'pending'
                            ? `${t('netWorth.loanPending')} · ${t('netWorth.loanPrincipal')} ${formatNumber(loan.principal)} · ${t('netWorth.loanInterest')} ${formatNumber(loan.interest)}`
                            : `${t('netWorth.loanPrincipal')} ${formatNumber(loan.principal)} · ${t('netWorth.loanInterest')} ${formatNumber(loan.interest)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-app-secondary">
                          {formatNumber(loan.remaining)}
                        </span>
                        <Link
                          to="/expenses/loan/$id"
                          params={{ id: loan.id }}
                          className="p-1.5 text-app-muted hover:text-app-primary"
                          aria-label={t('netWorth.openLoan')}
                        >
                          <FiPieChart size={15} />
                        </Link>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            <div className="px-4 pb-3">
              <Link
                to="/expenses/loans"
                className="text-xs font-medium text-[var(--color-app-accent)] no-underline hover:underline"
              >
                {t('netWorth.openLoans')}
              </Link>
            </div>
          </section>
        </div>
      )}

      <VaulDrawer
        show={assetOpen}
        onClose={(event) => {
          event?.preventDefault();
          setAssetOpen(false);
        }}
        title={
          assetDraft.id ? t('netWorth.editAssetTitle') : t('netWorth.addAssetTitle')
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="m-0 text-sm text-app-muted">
            {t('netWorth.assetValueHint')}
          </p>
          <div className="form-group">
            <label htmlFor="asset-kind">{t('netWorth.assetKind')}</label>
            <div className="input-wrapper">
              <select
                id="asset-kind"
                name="kind"
                className="form-input"
                value={assetDraft.kind}
                onChange={(event) =>
                  setAssetDraft((prev) => ({
                    ...prev,
                    kind: event.target.value as AssetDraft['kind'],
                  }))
                }
              >
                <option value="property">{t('netWorth.kindProperty')}</option>
                <option value="vehicle">{t('netWorth.kindVehicle')}</option>
                <option value="other">{t('netWorth.kindOther')}</option>
              </select>
            </div>
          </div>
          <FormField
            name="assetName"
            type="text"
            label={t('netWorth.assetName')}
            value={assetDraft.name}
            onChange={(event) =>
              setAssetDraft((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder={t('netWorth.assetNamePlaceholder')}
          />
          <FormField
            name="assetValue"
            type="number"
            label={t('netWorth.assetValue')}
            value={assetDraft.value}
            onChange={(event) =>
              setAssetDraft((prev) => ({ ...prev, value: event.target.value }))
            }
            step={0.01}
            min={0}
            placeholder="0"
          />
          <button
            type="button"
            className={BTN_SUBMIT_CLASS}
            onClick={saveAsset}
            disabled={savingAsset}
          >
            {savingAsset ? (
              <Loader variant="on-button" />
            ) : (
              <span>{t('netWorth.saveAsset')}</span>
            )}
          </button>
          {assetDraft.id && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-expense)]/40 bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-expense)] cursor-pointer hover:bg-[var(--color-expense)]/10"
              onClick={deleteAsset}
            >
              <FiTrash2 size={15} aria-hidden />
              {t('netWorth.deleteAsset')}
            </button>
          )}
        </div>
      </VaulDrawer>
    </div>
  );
};

export default NetWorth;
