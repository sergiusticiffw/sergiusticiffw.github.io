import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { Card, cn } from '@shared/ui';
import { formatNumber } from '@shared/utils/utils';
import { getAiItems, localToday } from '../../../../ai/data';
import {
  BudgetRing,
  BudgetWindow,
  budgetChoices,
  budgetStatus,
  budgetUnlockLabel,
  buildBudgetBaseline,
  buildBudgets,
  countCompleteExpenseMonths,
  labelToMonthKey,
  monthKeyLabel,
  monthPaceForView,
  summarizeBudgets,
} from '../../budgets/model';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useAnimatedRatio = (ratio: number, active = true, delay = 0) => {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (!active) {
      valueRef.current = 0;
      setValue(0);
      return;
    }

    const from = valueRef.current;
    const to = Math.max(0, ratio);
    if (prefersReducedMotion() || Math.abs(from - to) < 0.0005) {
      valueRef.current = to;
      setValue(to);
      return;
    }

    let frame = 0;
    const duration = from < 0.01 ? 820 : 560;
    const wait = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        const next = from + (to - from) * eased;
        valueRef.current = next;
        setValue(next);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, from < 0.01 ? delay : 0);

    return () => {
      window.clearTimeout(wait);
      cancelAnimationFrame(frame);
    };
  }, [ratio, active, delay]);

  return value;
};

const RADIUS = 28;
const CENTER = 36;

const STATUS_STROKE: Record<'ok' | 'ahead' | 'over', string> = {
  ok: '#6ee7b7',
  ahead: '#fbbf6a',
  over: '#ff8f8f',
};

const paceTick = (pace: number) => {
  const angle = 2 * Math.PI * pace - Math.PI / 2;
  const point = (r: number) => ({
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  });
  const inner = point(RADIUS - 5);
  const outer = point(RADIUS + 5);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
};

const windowLabel = (
  value: BudgetWindow,
  t: (key: string) => string
): string => {
  if (value === 'all') return t('budgetRings.allTime');
  return t('budgetRings.nMo').replace('{n}', String(value));
};

const Ring: React.FC<{
  ring: BudgetRing;
  pace: number;
  play: boolean;
  delay: number;
  tip: boolean;
  leftText: string;
  ofText: (spent: string, budget: string) => string;
  onShowTip: (id: string, hold: boolean) => void;
  onHideTip: (id: string) => void;
}> = ({
  ring,
  pace,
  play,
  delay,
  tip,
  leftText,
  ofText,
  onShowTip,
  onHideTip,
}) => {
  const circumference = 2 * Math.PI * RADIUS;
  const animated = useAnimatedRatio(Math.max(0, ring.ratio), play, delay);
  const shown = Math.min(animated, 1);
  const status = budgetStatus(animated, pace);
  const percent = Math.round(animated * 100);
  const showPace = pace > 0 && pace < 1;
  const stroke = STATUS_STROKE[status];

  return (
    <button
      type="button"
      data-ring-id={ring.id}
      className="relative flex flex-col items-center gap-1.5 border-0 bg-transparent p-1 cursor-pointer text-app-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-app-accent)]"
      aria-label={`${ring.label}: ${ofText(formatNumber(ring.spent), formatNumber(ring.budget))}, ${percent}%, ${leftText}`}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') onShowTip(ring.id, false);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onShowTip(ring.id, false);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onHideTip(ring.id);
      }}
      onFocus={() => onShowTip(ring.id, false)}
      onBlur={() => onHideTip(ring.id)}
      onClick={(event) => {
        if (event.detail === 0) return;
        const pointerType = (event.nativeEvent as PointerEvent).pointerType;
        onShowTip(ring.id, pointerType !== 'mouse');
      }}
    >
      <span className="relative inline-flex size-[72px] items-center justify-center">
        <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90" aria-hidden>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={6}
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={stroke}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - shown)}
          />
        </svg>
        {showPace && (
          <svg
            viewBox="0 0 72 72"
            className="pointer-events-none absolute inset-0 h-[72px] w-[72px]"
            aria-hidden
          >
            <line
              {...paceTick(pace)}
              stroke="var(--color-app-primary)"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.85}
            />
          </svg>
        )}
        <span className="absolute text-caption font-semibold tabular-nums text-app-primary">
          {percent}%
        </span>
        {tip && (
          <span
            role="status"
            className="absolute z-10 bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-left text-[0.7rem] leading-snug shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          >
            <strong className="block text-app-primary">{ring.label}</strong>
            <span className="block text-app-muted">
              {ofText(formatNumber(ring.spent), formatNumber(ring.budget))}
            </span>
            <span
              className={cn(
                'block font-medium',
                ring.left >= 0
                  ? 'text-[var(--color-income)]'
                  : 'text-[var(--color-expense)]'
              )}
            >
              {leftText}
            </span>
          </span>
        )}
      </span>
      <span className="max-w-[4.5rem] truncate text-center text-[0.7rem] text-app-muted">
        {ring.label}
      </span>
    </button>
  );
};

const SummaryBar: React.FC<{ ratio: number; pace: number }> = ({
  ratio,
  pace,
}) => {
  const animated = useAnimatedRatio(ratio, true, 80);
  const status = budgetStatus(animated, pace);
  const color = STATUS_STROKE[status];
  return (
    <div
      className="relative mx-4 mb-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
      aria-hidden
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-[width]"
        style={{
          width: `${Math.min(animated, 1) * 100}%`,
          backgroundColor: color,
        }}
      />
      {pace > 0 && pace < 1 && (
        <span
          className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-app-primary opacity-80"
          style={{ left: `${pace * 100}%` }}
        />
      )}
    </div>
  );
};

export interface BudgetRingsProps {
  monthLabel: string;
  /** When true (filters active), the widget is hidden. */
  visible?: boolean;
}

const BudgetRings: React.FC<BudgetRingsProps> = ({
  monthLabel,
  visible = true,
}) => {
  const { t } = useLocalization();
  const { data } = useExpenseData();
  const viewedKey = useMemo(
    () => (monthLabel ? labelToMonthKey(monthLabel) : null),
    [monthLabel]
  );

  const items = useMemo(() => getAiItems(data.raw || []), [data.raw]);
  const today = localToday();
  const pace = viewedKey ? monthPaceForView(viewedKey, today) : 0;

  const completeMonths = useMemo(
    () => (viewedKey ? countCompleteExpenseMonths(items, viewedKey) : 0),
    [items, viewedKey]
  );
  const { options, defaultWindow } = useMemo(
    () => budgetChoices(completeMonths),
    [completeMonths]
  );
  const [picked, setPicked] = useState<BudgetWindow | null>(null);
  const windowSize =
    picked && options.includes(picked) ? picked : defaultWindow;

  const baseline = useMemo(
    () =>
      visible && viewedKey && options.length
        ? buildBudgetBaseline(items, viewedKey, windowSize)
        : null,
    [items, viewedKey, windowSize, visible, options.length]
  );
  const rings = useMemo(
    () => (baseline ? buildBudgets(baseline) : []),
    [baseline]
  );
  const summary = useMemo(() => summarizeBudgets(rings), [rings]);

  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [tipId, setTipId] = useState<string | null>(null);
  const tipTimer = useRef<number | null>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const shown = showAll ? rings : rings.slice(0, 8);
  const orderKey = shown.map((ring) => ring.id).join('|');

  // Reset picked window when navigating months if current pick is unavailable
  useEffect(() => {
    if (picked && !options.includes(picked)) setPicked(null);
  }, [picked, options]);

  useLayoutEffect(() => {
    const root = ringsRef.current;
    if (!root || !open) {
      positions.current = new Map();
      return;
    }
    const origin = root.getBoundingClientRect();
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-ring-id]')];
    const next = new Map<string, { x: number; y: number }>();
    const animate = !prefersReducedMotion();
    for (const node of nodes) {
      const id = node.dataset.ringId || '';
      const rect = node.getBoundingClientRect();
      const position = { x: rect.left - origin.left, y: rect.top - origin.top };
      const previous = positions.current.get(id);
      next.set(id, position);
      if (!animate || !previous) continue;
      const dx = previous.x - position.x;
      const dy = previous.y - position.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    }
    positions.current = next;
  }, [orderKey, open]);

  useEffect(
    () => () => {
      if (tipTimer.current) window.clearTimeout(tipTimer.current);
    },
    []
  );

  const showTip = (id: string, hold: boolean) => {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    setTipId(id);
    if (!hold) return;
    tipTimer.current = window.setTimeout(() => setTipId(null), 10000);
  };

  const hideTip = (id: string) => {
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    setTipId((current) => (current === id ? null : current));
  };

  if (!visible || !monthLabel || !viewedKey) return null;

  const monthName = monthLabel.replace(/ \d{4}$/, '');
  const monthCount = baseline?.months.length || (windowSize === 'all' ? completeMonths : windowSize);
  const sourceMonth = baseline?.months[baseline.months.length - 1];
  const note =
    completeMonths < 3 && sourceMonth
      ? t('budgetRings.noteEarly')
          .replace('{viewed}', monthKeyLabel(viewedKey))
          .replace('{source}', monthKeyLabel(sourceMonth))
      : windowSize === 'all'
        ? t('budgetRings.noteAll').replace('{count}', String(monthCount))
        : t('budgetRings.noteAverage')
            .replace('{count}', String(monthCount))
            .replace(
              '{unit}',
              monthCount === 1
                ? t('budgetRings.month')
                : t('budgetRings.months')
            );

  const hasViewedExpenses = items.some(
    (item) => item.kind === 'expense' && item.month === viewedKey
  );
  const unlock = budgetUnlockLabel(viewedKey);
  const emptyMessage = options.length
    ? t('budgetRings.emptySuggestions')
    : hasViewedExpenses
      ? t('budgetRings.unlockAfterClose').replace('{date}', unlock)
      : t('budgetRings.unlockAddExpenses').replace('{date}', unlock);

  const unbudgeted = baseline?.unbudgeted || [];
  const remainingText = (left: number) =>
    left >= 0
      ? t('budgetRings.left').replace('{amount}', formatNumber(left))
      : t('budgetRings.overAmount').replace('{amount}', formatNumber(-left));
  const ofText = (spent: string, budget: string) =>
    t('budgetRings.of').replace('{spent}', spent).replace('{budget}', budget);

  return (
    <section className="mb-5">
      <Card
        variant="surface"
        padding="none"
        className="overflow-hidden border-[var(--color-border-subtle)]"
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left cursor-pointer"
          aria-expanded={open}
          aria-controls="monthly-budgets-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-app-primary">
              {t('budgetRings.title').replace('{month}', monthName)}
            </span>
            {rings.length > 0 ? (
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-app-muted">
                <span>
                  <strong className="font-semibold text-app-primary tabular-nums">
                    {formatNumber(summary.spent)}
                  </strong>{' '}
                  {t('budgetRings.ofBudget').replace(
                    '{budget}',
                    formatNumber(summary.budget)
                  )}
                </span>
                {summary.over > 0 && (
                  <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,#ff8f8f_22%,transparent)] px-2 py-0.5 text-xs font-semibold text-[#ff8f8f]">
                    {t('budgetRings.overCount').replace(
                      '{count}',
                      String(summary.over)
                    )}
                  </span>
                )}
              </span>
            ) : (
              <span className="mt-0.5 block text-sm text-app-muted">
                {options.length
                  ? t('budgetRings.noSuggestions')
                  : t('budgetRings.unlocks').replace('{date}', unlock)}
              </span>
            )}
          </span>
          <FiChevronDown
            size={18}
            className={cn(
              'shrink-0 text-app-muted transition-transform duration-200',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        {rings.length > 0 && <SummaryBar ratio={summary.ratio} pace={pace} />}

        <div
          id="monthly-budgets-panel"
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-4 pt-2">
              {rings.length === 0 ? (
                <p className="m-0 text-sm text-app-muted">{emptyMessage}</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-3">
                    {options.length > 1 && (
                      <div
                        className="flex w-full rounded-full bg-white/[0.06] p-0.5"
                        role="group"
                        aria-label={t('budgetRings.windowGroup')}
                        data-no-month-swipe
                      >
                        {options.map((value) => (
                          <button
                            key={String(value)}
                            type="button"
                            aria-pressed={value === windowSize}
                            className={cn(
                              'min-h-8 flex-1 rounded-full border-0 px-1.5 py-1.5 text-[0.7rem] font-semibold tabular-nums cursor-pointer transition-colors duration-200',
                              value === windowSize
                                ? 'bg-[var(--color-app-accent)] font-bold text-[var(--color-btn-on-accent)] shadow-[0_1px_6px_var(--color-app-accent-shadow)]'
                                : 'bg-transparent text-app-muted hover:text-app-primary'
                            )}
                            onClick={() => setPicked(value)}
                          >
                            {windowLabel(value, t)}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="m-0 text-[0.8rem] leading-snug text-app-muted">
                      {note}
                      {pace > 0 && pace < 1 && (
                        <span className="mt-1.5 flex items-center gap-1.5 text-[0.74rem] text-white/50">
                          <span
                            className="inline-block h-2.5 w-0.5 rounded-sm bg-white/80"
                            aria-hidden
                          />
                          {t('budgetRings.paceLegend')}
                        </span>
                      )}
                    </p>
                  </div>

                  <div
                    ref={ringsRef}
                    className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                  >
                    {shown.map((ring, index) => (
                      <Ring
                        key={ring.id}
                        ring={ring}
                        pace={pace}
                        play={open}
                        delay={index * 55}
                        tip={tipId === ring.id}
                        leftText={remainingText(ring.left)}
                        ofText={ofText}
                        onShowTip={showTip}
                        onHideTip={hideTip}
                      />
                    ))}
                  </div>

                  {rings.length > 8 && (
                    <button
                      type="button"
                      className="mt-3 mx-auto block border-0 bg-transparent p-0 text-sm font-semibold text-[var(--color-app-accent)] cursor-pointer"
                      onClick={() => setShowAll((value) => !value)}
                    >
                      {showAll
                        ? t('budgetRings.showFewer')
                        : t('budgetRings.showAll').replace(
                            '{count}',
                            String(rings.length)
                          )}
                    </button>
                  )}

                  {unbudgeted.length > 0 && (
                    <p className="mt-3 mb-0 text-xs text-app-muted">
                      {t('budgetRings.noHistoryYet')}{' '}
                      {unbudgeted
                        .map(
                          (entry) =>
                            `${entry.label} ${formatNumber(entry.spent)}`
                        )
                        .join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default BudgetRings;
