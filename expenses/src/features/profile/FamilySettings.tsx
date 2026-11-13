import React, { useCallback, useEffect, useState } from 'react';
import {
  FiUsers,
  FiTrash2,
  FiUserMinus,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType, categories } from '@shared/utils/constants';
import { useApiClient } from '@shared/hooks/useApiClient';
import { DeleteConfirmDrawer } from '@shared/components/Common';
import { getDataProviderKind, type Household } from '../../data';
import { useAuthState } from '@shared/context/context';

const categoryOptions = categories.filter((c) => c.value);

type ConfirmAction =
  | { type: 'leave' }
  | { type: 'remove'; userId: string; label: string }
  | null;

const FamilySettings: React.FC = () => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const api = useApiClient();
  const { userDetails } = useAuthState();
  const myUid = String(userDetails?.current_user?.uid || '');

  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('Family');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!api || getDataProviderKind() !== 'supabase') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await api.getHousehold();
    if (result.success) {
      setHousehold(result.data ?? null);
      if (result.data) {
        setName(result.data.name);
        setSelectedCats(result.data.shared_categories);
      }
    } else if (result.error) {
      showNotification(result.error.message, notificationType.ERROR);
    }
    setLoading(false);
  }, [api, showNotification]);

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
      showNotification(t('family.categoriesSaved'), notificationType.SUCCESS);
    });

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
          <div className="pt-4 md:pt-3">
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
          {isManager && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-app-primary outline-none focus:border-[var(--color-app-accent)]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={onSaveName}
                className="rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium text-app-secondary hover:bg-white/[0.04] disabled:opacity-50"
              >
                {t('family.rename')}
              </button>
            </div>
          )}

          <div>
            <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
              {t('family.members')}
            </h4>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {household.members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="text-app-secondary">
                    {m.user_id === myUid
                      ? t('family.you')
                      : m.user_id.slice(0, 8) + '…'}{' '}
                    <span className="text-app-muted">({m.role})</span>
                  </span>
                  {isManager &&
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
                            label: m.user_id.slice(0, 8) + '…',
                          })
                        }
                        className="text-red-400 p-1.5"
                      >
                        <FiUserMinus />
                      </button>
                    )}
                </li>
              ))}
            </ul>
          </div>

          {isManager && (
            <div>
              <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('family.invite')}
              </h4>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('family.emailPlaceholder')}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-app-primary outline-none focus:border-[var(--color-app-accent)]"
                />
                <button
                  type="button"
                  disabled={busy || !inviteEmail.trim()}
                  onClick={onInvite}
                  className="rounded-lg bg-[var(--color-app-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-btn-on-accent)] disabled:opacity-50"
                >
                  {t('family.sendInvite')}
                </button>
              </div>
              {household.invites.length > 0 && (
                <ul className="mt-2 m-0 flex list-none flex-col gap-1.5 p-0">
                  {household.invites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-2 text-sm text-app-muted"
                    >
                      <span>
                        {inv.email} · {inv.status}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRevoke(inv.id)}
                        className="text-red-400 p-1"
                        aria-label={t('family.revoke')}
                      >
                        <FiTrash2 />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="m-0 mt-2 text-xs text-app-muted">
                {t('family.inviteHint')}
              </p>
            </div>
          )}

          {isManager && (
            <div>
              <h4 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                {t('family.sharedCategories')}
              </h4>
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
              <button
                type="button"
                disabled={busy}
                onClick={onSaveCategories}
                className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-app-secondary hover:bg-white/[0.04] disabled:opacity-50"
              >
                {t('family.saveCategories')}
              </button>
            </div>
          )}

          {!isManager && household.shared_categories.length > 0 && (
            <p className="m-0 text-sm text-app-muted">
              {t('family.sharedCount').replace(
                '{count}',
                String(household.shared_categories.length)
              )}
            </p>
          )}

          {household.my_role !== 'owner' && (
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
