import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FiBarChart2,
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
import {
  useGoalsEnabled,
  useLoansEnabled,
  useSettingsCurrency,
} from '@stores/settingsStore';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';
import {
  DeleteConfirmDrawer,
  FormField,
  Loader,
  LoadingSpinner,
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

const chipClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-app-primary cursor-pointer hover:bg-white/10';

const NetWorth = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const currency = useSettingsCurrency();
  const goalsEnabled = useGoalsEnabled();
  const loansEnabled = useLoansEnabled();
  const fund = useEmergencyFund();
  const assetsState = useNetWorthAssets();
  const { data, dataDispatch } = useLoan();
  const apiClient = useApiClient();
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(emptyDraft);
  const [savingAsset, setSavingAsset] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const assetsListRef = useRef<HTMLUListElement>(null);
  const isDesktop = isDesktopLayout();
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

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

  const handleEditById = (id: string) => {
    const asset = assetsState.items.find((item) => item.id === id);
    if (asset) openEditAsset(asset);
  };

  const deleteAsset = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      removeNetWorthAsset(deleteId);
      setDeleteId(null);
      const synced = await persistAssetsToCloud();
      showNotification(
        synced ? t('netWorth.assetDeleted') : t('goals.savedOffline'),
        notificationType.SUCCESS
      );
    } catch {
      showNotification(t('goals.syncError'), notificationType.ERROR);
    } finally {
      setDeleting(false);
    }
  };

  const loading = data.loading && !data.loans;

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div className="mb-5 pt-4 flex flex-col items-stretch">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-white text-left">
          {t('netWorth.title')}
        </h1>
        <p className="m-0 mt-1 text-sm text-white/50 text-left">
          {t('netWorth.subtitle')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            to="/expenses/charts"
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-white/55 no-underline hover:text-[var(--color-app-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-app-accent)]"
          >
            <FiBarChart2 className="size-3.5 shrink-0" aria-hidden />
            <span>{t('netWorth.openCharts')}</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4 pb-8 w-full">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 pb-5 shadow-lg">
            <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              {t('netWorth.netWorth')}
            </h2>
            <div className="mb-2">
              <span
                className={`text-4xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${
                  snapshot.netWorth >= 0
                    ? 'text-white'
                    : 'text-[var(--color-expense)]'
                }`}
              >
                {formatNumber(snapshot.netWorth)}
              </span>
              <span className="ml-2 text-sm font-medium text-white/45">
                {currency}
              </span>
            </div>
            <p className="m-0 text-sm text-white/55">{t('netWorth.formula')}</p>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <h2 className="m-0 text-sm font-semibold text-app-primary inline-flex items-center gap-2">
                <FiDollarSign className="text-[var(--color-income)]" />
                {t('netWorth.assets')}
              </h2>
              <span className="text-sm font-bold tabular-nums text-[var(--color-income)]">
                {formatNumber(snapshot.assets)} {currency}
              </span>
            </div>
            <ul
              ref={assetsListRef}
              className="m-0 p-0 list-none overflow-x-hidden"
            >
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
                    <p className="m-0 mt-0.5 text-caption text-app-muted">
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
                const isThisItemSwiped = swipedItemId === asset.id;
                return (
                  <li
                    key={asset.id}
                    className={`relative overflow-hidden ${
                      index < list.length - 1
                        ? 'border-b border-white/[0.04]'
                        : ''
                    }`}
                  >
                    {!isDesktop && (
                      <div
                        data-swipe-actions
                        className={`absolute inset-0 z-[1] flex items-center justify-between opacity-0 transition-opacity duration-200 pointer-events-none ${
                          isThisItemSwiped && (deleteVisible || editVisible)
                            ? 'opacity-100'
                            : ''
                        }`}
                      >
                        {isThisItemSwiped && deleteVisible && (
                          <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_12px_rgba(239,68,68,0.4)] [&_svg]:text-[1.1rem]">
                            <FiTrash2 />
                          </div>
                        )}
                        {isThisItemSwiped && editVisible && (
                          <div className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-white shadow-[0_2px_12px_var(--color-app-accent-shadow)] [&_svg]:text-[1.1rem]">
                            <FiEdit2 />
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      data-id={asset.id}
                      className="relative z-[1] flex items-center justify-between gap-3 px-4 py-3 bg-[var(--color-app-bg)] [background-image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]"
                      style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                      onTouchStart={
                        !isDesktop
                          ? (e) => handleTouchStart(e, asset.id, assetsListRef)
                          : undefined
                      }
                      onTouchMove={
                        !isDesktop
                          ? (e) => handleTouchMove(e, assetsListRef)
                          : undefined
                      }
                      onTouchEnd={
                        !isDesktop
                          ? (e) =>
                              handleTouchEnd(
                                e,
                                assetsListRef,
                                asset.id,
                                handleEditById,
                                setDeleteId
                              )
                          : undefined
                      }
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
                          <p className="m-0 mt-0.5 text-caption text-app-muted">
                            {kindLabel(asset.kind)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-app-secondary">
                          {formatNumber(asset.value)}
                        </span>
                        {isDesktop && (
                          <>
                            <button
                              type="button"
                              className="p-1.5 border-none bg-transparent text-app-muted hover:text-app-primary cursor-pointer"
                              onClick={() => openEditAsset(asset)}
                              aria-label={t('netWorth.editAsset')}
                            >
                              <FiEdit2 size={15} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 border-none bg-transparent text-app-muted hover:text-app-primary cursor-pointer"
                              onClick={() => setDeleteId(asset.id)}
                              aria-label={t('netWorth.deleteAsset')}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-3 border-t border-white/10 flex flex-col gap-2">
              <p className="m-0 text-caption text-app-muted">
                {t('netWorth.addAssetHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={chipClass}
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
                  className={chipClass}
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
                  className={chipClass}
                  onClick={() => openNewAsset()}
                >
                  <FiPlus size={13} aria-hidden />
                  {t('netWorth.addAsset')}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
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
                        <p className="m-0 mt-0.5 text-caption text-app-muted">
                          {loan.status === 'pending'
                            ? `${t('netWorth.loanPending')} · ${t('netWorth.loanPrincipal')} ${formatNumber(loan.principal)} · ${t('netWorth.loanInterest')} ${formatNumber(loan.interest)}`
                            : `${t('netWorth.loanPrincipal')} ${formatNumber(loan.principal)} · ${t('netWorth.loanInterest')} ${formatNumber(loan.interest)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-app-secondary">
                          {formatNumber(loan.remaining)}
                        </span>
                        {loansEnabled && (
                          <Link
                            to="/expenses/loan/$id"
                            params={{ id: String(loan.id) }}
                            className="p-1.5 text-app-muted hover:text-app-primary"
                            aria-label={t('netWorth.openLoan')}
                          >
                            <FiPieChart size={15} />
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            {loansEnabled && (
              <div className="px-4 pb-3 pt-1">
                <Link
                  to="/expenses/loans"
                  className="text-sm font-medium text-white/55 no-underline hover:text-[var(--color-app-accent)]"
                >
                  {t('netWorth.openLoans')}
                </Link>
              </div>
            )}
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
        footer={
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
        </div>
      </VaulDrawer>

      <DeleteConfirmDrawer
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={deleteAsset}
        title={t('netWorth.deleteAsset')}
        isSubmitting={deleting}
      />
    </div>
  );
};

export default NetWorth;
