import { useEffect, useState } from 'react';
import { FiBarChart2, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { Switch } from '@shared/ui';
import ChartsVisibilityDnd from '@shared/components/ChartsVisibilityDnd/ChartsVisibilityDnd';
import { availableCharts, notificationType } from '@shared/utils/constants';
import {
  readCustomChartsEnabled,
  readStoredVisibleCharts,
  writeCustomChartsEnabled,
  writeStoredVisibleCharts,
} from '@shared/utils/chartsVisibility';
import { persistChartsToSupabase } from '@features/profile/preferencesSync';
import { getDataProviderKind } from '../../../../data';

type ChartsCustomizerProps = {
  /** Called after visibility changes so the Charts page can re-read its list. */
  onChange?: () => void;
};

/**
 * Chooses which charts appear on the Charts page and in what order.
 * Moved here from Profile; it stores the same keys and syncs the same way.
 */
const ChartsCustomizer = ({ onChange }: ChartsCustomizerProps) => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const [open, setOpen] = useState(false);
  const [customChartsEnabled, setCustomChartsEnabled] = useState(
    readCustomChartsEnabled
  );
  const [visibleCharts, setVisibleCharts] = useState<string[]>(
    readStoredVisibleCharts
  );

  // Cloud preferences can arrive after mount; pick them up when they do.
  useEffect(() => {
    const onPrefsApplied = () => {
      setCustomChartsEnabled(readCustomChartsEnabled());
      setVisibleCharts(readStoredVisibleCharts());
    };
    window.addEventListener('expenses:prefs-applied', onPrefsApplied);
    return () =>
      window.removeEventListener('expenses:prefs-applied', onPrefsApplied);
  }, []);

  const syncChartsToCloud = async (options: {
    visibleCharts: string[];
    customChartsEnabled: boolean;
    notify: boolean;
  }) => {
    if (!navigator.onLine) {
      if (options.notify) {
        showNotification(t('goals.savedOffline'), notificationType.SUCCESS);
      }
      return;
    }
    if (getDataProviderKind() !== 'supabase') {
      if (options.notify) {
        showNotification(t('goals.localOnly'), notificationType.SUCCESS);
      }
      return;
    }
    const ok = await persistChartsToSupabase({
      visibleCharts: options.visibleCharts,
      customChartsEnabled: options.customChartsEnabled,
    });
    if (options.notify || !ok) {
      showNotification(
        ok ? t('notification.profileUpdated') : t('goals.syncErrorDrive'),
        ok ? notificationType.SUCCESS : notificationType.ERROR
      );
    }
  };

  const handleCustomChartsEnabledChange = async (checked: boolean) => {
    setCustomChartsEnabled(checked);
    writeCustomChartsEnabled(checked);
    onChange?.();
    await syncChartsToCloud({
      visibleCharts,
      customChartsEnabled: checked,
      notify: true,
    });
  };

  const handleVisibleChartsChange = async (next: string[]) => {
    setVisibleCharts(next);
    writeStoredVisibleCharts(next);
    onChange?.();
    // Silent sync while dragging/reordering; toast only on failure.
    await syncChartsToCloud({
      visibleCharts: next,
      customChartsEnabled,
      notify: false,
    });
  };

  const orderedVisible = visibleCharts.filter((c) => availableCharts.includes(c));
  const hiddenCharts = availableCharts.filter((c) => !visibleCharts.includes(c));

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors md:rounded-[10px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2.5 border-none bg-transparent px-5 py-4 text-left md:px-4"
      >
        <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
          <FiBarChart2 aria-hidden="true" />
          <h3 className="m-0 text-base font-semibold tracking-tight text-app-primary md:text-sm">
            {t('charts.customize')}
          </h3>
        </div>
        {open ? (
          <FiChevronUp className="text-app-muted" aria-hidden="true" />
        ) : (
          <FiChevronDown className="text-app-muted" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 md:px-4 md:pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span
              id="charts-customize-label"
              className="text-body text-app-secondary"
            >
              {t('profile.chartsCustomize')}
            </span>
            <Switch
              checked={customChartsEnabled}
              onCheckedChange={handleCustomChartsEnabledChange}
              aria-labelledby="charts-customize-label"
            />
          </div>
          {customChartsEnabled && (
            <>
              <p className="mb-3 text-xs text-app-muted">
                {t('profile.chartsDragHint')}
              </p>
              <ChartsVisibilityDnd
                visibleCharts={orderedVisible}
                hiddenCharts={hiddenCharts}
                onVisibleChartsChange={handleVisibleChartsChange}
                t={t}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChartsCustomizer;
