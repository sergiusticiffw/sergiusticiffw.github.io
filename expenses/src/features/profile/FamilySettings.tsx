import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiUsers,
  FiTrash2,
  FiUserMinus,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiUserPlus,
  FiGrid,
} from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType, categories } from '@shared/utils/constants';
import { useApiClient } from '@shared/hooks/useApiClient';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import { DeleteConfirmDrawer } from '@shared/components/Common';
import VaulDrawer from '@shared/components/VaulDrawer';
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { getDataProviderKind, type Household } from '../../data';
import { useAuthState } from '@shared/context/context';

const categoryOptions = categories.filter((c) => c.value);

type ConfirmAction =
  | { type: 'leave' }
  | { type: 'remove'; userId: string; label: string }
  | null;

const NAME_SWIPE_ID = 'family-name';

const FamilySettings: React.FC = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const api = useApiClient();
  const { userDetails } = useAuthState();
  const myUid = String(userDetails?.current_user?.uid || '');
  const isDesktop = isDesktopLayout();
  const listRef = useRef<HTMLDivElement>(null);
  const inviteListRef = useRef<HTMLDivElement>(null);

  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('Family');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [open, setOpen] = useState(false);

  const {
    swipedItemId,
    deleteVisible,
    editVisible,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeActions();

  const reload = useCallback(async () => {
    if (!api || getDataProviderKind() !== 'supabase' || !myUid) {
      setLoading(false);
      if (!myUid) setHousehold(null);
      return;
    }
    setLoading(true);
    const result = await api.getHousehold();
    if (result.success) {
      setHousehold(result.data ?? null);
      if (result.data) {
        setName(result.data.name);
        setSelectedCats(result.data.shared_categories);
        setRenameOpen(false);
      }
    } else if (result.error) {
      showNotification(result.error.message, notificationType.ERROR);
    }
    setLoading(false);
  }, [api, myUid, showNotification]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (getDataProviderKind() !== 'supabase') {
    return null;
  }

  const isManager =
    household?.my_role === 'owner' || household?.my_role === 'admin';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onCreate = () =>
    run(async () => {
      if (!api) return;
      const result = await api.createHousehold(name);
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setHousehold(result.data!);
      setSelectedCats(result.data!.shared_categories);
      showNotification(t('family.created'), notificationType.SUCCESS);
    });

  const openRename = () => {
    if (household) setName(household.name);
    setRenameOpen(true);
  };

  const onSaveName = () =>
    run(async () => {
      if (!api) return;
      const result = await api.updateHouseholdName(name);
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setHousehold(result.data!);
      setRenameOpen(false);
      showNotification(t('family.saved'), notificationType.SUCCESS);
    });

  const onSaveCategories = () =>
    run(async () => {
      if (!api) return;
      const result = await api.updateSharedCategories(selectedCats);
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setHousehold(result.data!);
      setCategoriesOpen(false);
      showNotification(t('family.categoriesSaved'), notificationType.SUCCESS);
    });

  const openCategories = () => {
    if (household) setSelectedCats([...household.shared_categories]);
    setCategoriesOpen(true);
  };

  const onInvite = () =>
    run(async () => {
      if (!api || !inviteEmail.trim()) return;
      const result = await api.inviteByEmail(inviteEmail.trim());
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setHousehold(result.data!);
      setInviteEmail('');
      showNotification(t('family.inviteSent'), notificationType.SUCCESS);
    });

  const onRevoke = (id: string) =>
    run(async () => {
      if (!api) return;
      const result = await api.revokeInvite(id);
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setHousehold(result.data!);
    });

  const onRemove = (uid: string) =>
    run(async () => {
      if (!api) return;
      const result = await api.removeMember(uid);
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setConfirm(null);
      setHousehold(result.data!);
      showNotification(t('family.memberRemoved'), notificationType.SUCCESS);
    });

  const onLeave = () =>
    run(async () => {
      if (!api) return;
      const result = await api.leaveHousehold();
      if (!result.success) {
        showNotification(
          result.error?.message || t('family.error'),
          notificationType.ERROR
        );
        return;
      }
      setConfirm(null);
      setHousehold(null);
      showNotification(t('family.left'), notificationType.SUCCESS);
    });

  const onConfirmAction = () => {
    if (!confirm) return;
    if (confirm.type === 'leave') onLeave();
    else onRemove(confirm.userId);
  };

  const toggleCat = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSwipeEdit = (id: string) => {
    if (id === NAME_SWIPE_ID) openRename();
  };

  const handleSwipeDelete = (id: string) => {
    if (!household || busy) return;
    if (id.startsWith('member-')) {
      const userId = id.slice('member-'.length);
      const m = household.members.find((row) => row.user_id === userId);
      if (!m) return;
      if (userId === myUid && household.my_role !== 'owner') {
        setConfirm({ type: 'leave' });
        return;
      }
      if (isManager && m.role !== 'owner' && userId !== myUid) {
        const label =
          m.email || m.name || m.user_id.slice(0, 8) + '…';
        setConfirm({ type: 'remove', userId, label });
      }
      return;
    }
    if (id.startsWith('invite-')) {
      const inviteId = id.slice('invite-'.length);
      void onRevoke(inviteId);
    }
  };

  const canDeleteMember = (userId: string, role: string) => {
    if (userId === myUid && household?.my_role !== 'owner') return true;
    if (isManager && role !== 'owner' && userId !== myUid) return true;
    return false;
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden md:rounded-[10px] transition-colors active:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-2.5 py-5 px-5 md:py-4 md:px-4 text-left bg-transparent border-none cursor-pointer [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:shrink-0"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
          <FiUsers />
          <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
            {t('family.title')}
          </h3>
        </div>
        {open ? (
          <FiChevronUp className="text-app-muted" aria-hidden />
        ) : (
          <FiChevronDown className="text-app-muted" aria-hidden />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 md:px-4 md:pb-4 border-t border-white/[0.06]">
          <div className="pt-4 md:pt-3" ref={listRef}>
            <p className="m-0 mb-4 text-sm text-app-muted leading-relaxed">
              {t('family.hint')}
            </p>

            {loading ? (
              <p className="m-0 text-sm text-app-muted">{t('common.loading')}</p>
            ) : !household ? (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('family.namePlaceholder')}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-app-primary outline-none focus:border-[var(--color-app-accent)]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCreate}
                  className="rounded-lg bg-[var(--color-app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-btn-on-accent)] disabled:opacity-50"
                >
                  {t('family.create')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {isManager ? (
                  <div className="relative w-full overflow-hidden rounded-lg">
                    {!isDesktop && (
                      <div
                        data-swipe-actions
                        className={`absolute inset-0 z-[1] flex items-center justify-between pointer-events-none opacity-0 transition-opacity duration-200 ${
                          swipedItemId === NAME_SWIPE_ID && editVisible
                            ? 'opacity-100'
                            : ''
                        }`}
                      >
                        {swipedItemId === NAME_SWIPE_ID && editVisible && (
                          <div className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-white shadow-[0_2px_12px_var(--color-app-accent-shadow)] [&_svg]:text-base">
                            <FiEdit2 />
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      data-id={NAME_SWIPE_ID}
                      className="relative z-[1] flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-white/[0.03] px-3 py-2.5 text-left text-sm"
                      style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                      onClick={openRename}
                      onTouchStart={
                        !isDesktop
                          ? (e) =>
                              handleTouchStart(e, NAME_SWIPE_ID, listRef)
                          : undefined
                      }
                      onTouchMove={
                        !isDesktop
                          ? (e) => handleTouchMove(e, listRef)
                          : undefined
                      }
                      onTouchEnd={
                        !isDesktop
                          ? (e) =>
                              handleTouchEnd(
                                e,
                                listRef,
                                NAME_SWIPE_ID,
                                handleSwipeEdit,
                                () => undefined
                              )
                          : undefined
                      }
                    >
                      <span className="min-w-0 truncate font-medium text-app-primary">
                        {household.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-app-muted">
                        <FiEdit2 size={12} aria-hidden />
                        {t('family.editName')}
                      </span>
                    </button>
                  </div>
                ) : (
                  <p className="m-0 text-sm font-medium text-app-primary">
                    {household.name}
                  </p>
                )}

                <div>
                  <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                    {t('family.members')}
                  </h4>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {household.members.map((m) => {
                      const label =
                        m.user_id === myUid
                          ? t('family.you')
                          : m.email || m.name || m.user_id.slice(0, 8) + '…';
                      const rowId = `member-${m.user_id}`;
                      const allowDelete = canDeleteMember(m.user_id, m.role);
                      const isThisSwiped = swipedItemId === rowId;

                      return (
                        <li
                          key={m.user_id}
                          className="relative w-full overflow-hidden rounded-lg"
                        >
                          {!isDesktop && allowDelete && (
                            <div
                              data-swipe-actions
                              className={`absolute inset-0 z-[1] flex items-center justify-between pointer-events-none opacity-0 transition-opacity duration-200 ${
                                isThisSwiped && deleteVisible
                                  ? 'opacity-100'
                                  : ''
                              }`}
                            >
                              {isThisSwiped && deleteVisible && (
                                <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_12px_rgba(239,68,68,0.4)] [&_svg]:text-base">
                                  {m.user_id === myUid ? (
                                    <FiTrash2 />
                                  ) : (
                                    <FiUserMinus />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <div
                            data-id={rowId}
                            className="relative z-[1] flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                            style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                            onTouchStart={
                              !isDesktop && allowDelete
                                ? (e) => handleTouchStart(e, rowId, listRef)
                                : undefined
                            }
                            onTouchMove={
                              !isDesktop && allowDelete
                                ? (e) => handleTouchMove(e, listRef)
                                : undefined
                            }
                            onTouchEnd={
                              !isDesktop && allowDelete
                                ? (e) =>
                                    handleTouchEnd(
                                      e,
                                      listRef,
                                      rowId,
                                      () => undefined,
                                      handleSwipeDelete
                                    )
                                : undefined
                            }
                          >
                            <span className="min-w-0 break-all text-app-secondary">
                              {label}{' '}
                              <span className="text-app-muted">({m.role})</span>
                            </span>
                            {isDesktop &&
                              isManager &&
                              m.role !== 'owner' &&
                              m.user_id !== myUid && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  aria-label={t('family.removeMember')}
                                  onClick={() =>
                                    setConfirm({
                                      type: 'remove',
                                      userId: m.user_id,
                                      label,
                                    })
                                  }
                                  className="shrink-0 p-1.5 text-red-400"
                                >
                                  <FiUserMinus />
                                </button>
                              )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {isManager && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-app-secondary hover:bg-white/[0.05]"
                    >
                      <span className="flex items-center gap-2">
                        <FiUserPlus className="text-[var(--color-app-accent)]" />
                        {t('family.invite')}
                      </span>
                      {household.invites.length > 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-app-muted">
                          {household.invites.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={openCategories}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-app-secondary hover:bg-white/[0.05]"
                >
                  <span className="flex items-center gap-2">
                    <FiGrid className="text-[var(--color-app-accent)]" />
                    {t('family.sharedCategories')}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-app-muted">
                    {household.shared_categories.length}
                  </span>
                </button>

                {household.my_role !== 'owner' && isDesktop && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm({ type: 'leave' })}
                    className="rounded-lg border border-red-500/30 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {t('family.leave')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <VaulDrawer
        show={renameOpen}
        onClose={(e) => {
          e.preventDefault();
          if (busy) return;
          if (household) setName(household.name);
          setRenameOpen(false);
        }}
        title={t('family.editName')}
        footer={
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={onSaveName}
            className={BTN_SUBMIT_CLASS}
          >
            {t('family.rename')}
          </button>
        }
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('family.namePlaceholder')}
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-app-primary outline-none focus:border-[var(--color-app-accent)]"
        />
      </VaulDrawer>

      <VaulDrawer
        show={categoriesOpen}
        onClose={(e) => {
          e.preventDefault();
          if (busy) return;
          if (household) setSelectedCats([...household.shared_categories]);
          setCategoriesOpen(false);
        }}
        title={t('family.sharedCategories')}
        footer={
          isManager ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSaveCategories}
              className={BTN_SUBMIT_CLASS}
            >
              {t('family.saveCategories')}
            </button>
          ) : undefined
        }
      >
        {isManager ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {categoryOptions.map((cat) => (
              <label
                key={cat.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-app-secondary hover:bg-white/[0.03]"
              >
                <input
                  type="checkbox"
                  checked={selectedCats.includes(cat.value)}
                  onChange={() => toggleCat(cat.value)}
                  className="accent-[var(--color-app-accent)]"
                />
                {cat.label}
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-app-muted">
              {t('family.sharedCategoriesViewHint')}
            </p>
            {(household?.shared_categories.length ?? 0) === 0 ? (
              <p className="m-0 text-sm text-app-muted">
                {t('family.sharedCategoriesEmpty')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {household!.shared_categories.map((id) => {
                  const label =
                    categoryOptions.find((c) => c.value === id)?.label || id;
                  return (
                    <li
                      key={id}
                      className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-app-primary"
                    >
                      {label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </VaulDrawer>

      <VaulDrawer
        show={inviteOpen}
        onClose={(e) => {
          e.preventDefault();
          if (busy) return;
          setInviteOpen(false);
          setInviteEmail('');
        }}
        title={t('family.invite')}
        footer={
          <button
            type="button"
            disabled={busy || !inviteEmail.trim()}
            onClick={onInvite}
            className={BTN_SUBMIT_CLASS}
          >
            {t('family.sendInvite')}
          </button>
        }
      >
        <div ref={inviteListRef} className="flex flex-col gap-4">
          <p className="m-0 text-sm text-app-muted leading-relaxed">
            {t('family.inviteHint')}
          </p>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t('family.emailPlaceholder')}
            autoComplete="email"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-app-primary outline-none focus:border-[var(--color-app-accent)]"
          />
          {household && household.invites.length > 0 && (
            <div>
              <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('family.pendingInvites')}
              </h4>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {household.invites.map((inv) => {
                  const rowId = `invite-${inv.id}`;
                  const isThisSwiped = swipedItemId === rowId;
                  return (
                    <li
                      key={inv.id}
                      className="relative w-full overflow-hidden rounded-lg"
                    >
                      {!isDesktop && (
                        <div
                          data-swipe-actions
                          className={`absolute inset-0 z-[1] flex items-center justify-between pointer-events-none opacity-0 transition-opacity duration-200 ${
                            isThisSwiped && deleteVisible ? 'opacity-100' : ''
                          }`}
                        >
                          {isThisSwiped && deleteVisible && (
                            <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_12px_rgba(239,68,68,0.4)] [&_svg]:text-base">
                              <FiTrash2 />
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        data-id={rowId}
                        className="relative z-[1] flex w-full items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-app-muted"
                        style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                        onTouchStart={
                          !isDesktop
                            ? (e) =>
                                handleTouchStart(e, rowId, inviteListRef)
                            : undefined
                        }
                        onTouchMove={
                          !isDesktop
                            ? (e) => handleTouchMove(e, inviteListRef)
                            : undefined
                        }
                        onTouchEnd={
                          !isDesktop
                            ? (e) =>
                                handleTouchEnd(
                                  e,
                                  inviteListRef,
                                  rowId,
                                  () => undefined,
                                  handleSwipeDelete
                                )
                            : undefined
                        }
                      >
                        <span>
                          {inv.email} · {inv.status}
                        </span>
                        {isDesktop && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onRevoke(inv.id)}
                            className="p-1 text-red-400"
                            aria-label={t('family.revoke')}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </VaulDrawer>

      <DeleteConfirmDrawer
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={onConfirmAction}
        isSubmitting={busy}
        title={
          confirm?.type === 'leave'
            ? t('family.leaveConfirmTitle')
            : t('family.removeConfirmTitle')
        }
        message={
          confirm?.type === 'leave'
            ? t('family.leaveConfirmMessage')
            : t('family.removeConfirmMessage').replace(
                '{member}',
                confirm?.type === 'remove' ? confirm.label : ''
              )
        }
        confirmLabel={
          confirm?.type === 'leave'
            ? t('family.leave')
            : t('family.removeMember')
        }
      />
    </div>
  );
};

export default FamilySettings;
