import React, { useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
} from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';

/** Point-in-rect for custom collision: when pointer is in a column, that column wins as drop target */
function isPointInRect(
  point: { x: number; y: number },
  rect: { top: number; left: number; bottom: number; right: number }
) {
  return rect.top <= point.y && point.y <= rect.bottom && rect.left <= point.x && point.x <= rect.right;
}

/** Prefer column containers as drop target when pointer is inside them (fixes Visible→Hidden never registering) */
function chartsCollisionDetection(args: {
  pointerCoordinates: { x: number; y: number } | null;
  droppableRects: Map<UniqueIdentifier, { top: number; left: number; bottom: number; right: number }>;
  droppableContainers: Array< { id: UniqueIdentifier; [key: string]: unknown }>;
}) {
  const base = pointerWithin(args);
  const pointer = args.pointerCoordinates;
  if (!pointer) return base;

  const hiddenRect = args.droppableRects.get(HIDDEN_DROPPABLE);
  const inHidden = hiddenRect && isPointInRect(pointer, hiddenRect);
  const hiddenContainer = args.droppableContainers.find((c) => c.id === HIDDEN_DROPPABLE);

  // When pointer is in Hidden column, force that column as primary drop target (fixes Visible→Hidden)
  if (inHidden && hiddenContainer) {
    const columnCollision = { id: HIDDEN_DROPPABLE, data: { droppableContainer: hiddenContainer, value: 0 } };
    return [columnCollision, ...base.filter((c) => c.id !== HIDDEN_DROPPABLE)];
  }
  return base;
}
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BsGripVertical, BsArrowRight, BsArrowLeft } from 'react-icons/bs';

const VISIBLE_DROPPABLE = 'charts-visible';
const HIDDEN_DROPPABLE = 'charts-hidden';

type Section = 'visible' | 'hidden';

interface ChartsVisibilityDndProps {
  visibleCharts: string[];
  hiddenCharts: string[];
  onVisibleChartsChange: (visible: string[]) => void;
  t: (key: string) => string;
}

function SortableChartItem({
  chart,
  section,
  isHidden,
  onMoveToHidden,
  moveToHiddenLabel,
}: {
  chart: string;
  section: Section;
  isHidden: boolean;
  onMoveToHidden?: (chart: string) => void;
  moveToHiddenLabel?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: chart,
    data: { chart, section } as Record<string, unknown>,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2 px-3 rounded-lg border cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
        isDragging
          ? 'opacity-90 shadow-lg z-50 bg-app-surface border-[var(--color-app-accent)]/50'
          : isHidden
            ? 'bg-app-surface border-app-subtle hover:border-white/20'
            : 'bg-app-surface border-app-subtle hover:border-[var(--color-app-accent)]/40'
      }`}
      {...attributes}
      {...listeners}
    >
      <BsGripVertical className="text-app-muted shrink-0" aria-hidden />
      <span
        className={`text-sm truncate flex-1 min-w-0 ${
          isHidden ? 'text-app-secondary' : 'text-app-primary'
        }`}
      >
        {chart}
      </span>
      {onMoveToHidden && moveToHiddenLabel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToHidden(chart);
          }}
          className="shrink-0 p-1 rounded text-app-muted hover:text-app-primary hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-app-accent)]"
          title={moveToHiddenLabel}
          aria-label={moveToHiddenLabel}
        >
          <BsArrowRight size={18} />
        </button>
      )}
    </div>
  );
}

function DraggableHiddenItem({
  chart,
  onMoveToVisible,
  moveToVisibleLabel,
}: {
  chart: string;
  onMoveToVisible?: (chart: string) => void;
  moveToVisibleLabel?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `hidden-${chart}`,
      data: { chart, section: 'hidden' as Section },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined as string | undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2 px-3 rounded-lg border cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
        isDragging
          ? 'opacity-90 shadow-lg z-50 bg-app-surface border-[var(--color-app-accent)]/50'
          : 'bg-app-surface border-app-subtle hover:border-white/20'
      }`}
      {...attributes}
      {...listeners}
    >
      <BsGripVertical className="text-app-muted shrink-0" aria-hidden />
      <span className="text-sm text-app-secondary truncate flex-1 min-w-0">
        {chart}
      </span>
      {onMoveToVisible && moveToVisibleLabel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToVisible(chart);
          }}
          className="shrink-0 p-1 rounded text-app-muted hover:text-app-primary hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-app-accent)]"
          title={moveToVisibleLabel}
          aria-label={moveToVisibleLabel}
        >
          <BsArrowLeft size={18} />
        </button>
      )}
    </div>
  );
}

export default function ChartsVisibilityDnd({
  visibleCharts,
  hiddenCharts,
  onVisibleChartsChange,
  t,
}: ChartsVisibilityDndProps) {
  const lastOverRef = useRef<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } })
  );

  const handleDragOver = (event: DragOverEvent) => {
    lastOverRef.current = event.over?.id ?? null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const overId = over?.id ?? lastOverRef.current;
    lastOverRef.current = null;
    if (overId == null) return;

    const activeId = String(active.id);
    const activeData = active.data.current as { chart?: string; section?: Section } | undefined;
    const chart =
      activeData?.chart ??
      (activeId.startsWith('hidden-') ? activeId.replace('hidden-', '') : activeId);
    const fromVisible =
      activeData?.section === 'visible' || (!activeId.startsWith('hidden-') && visibleCharts.includes(activeId));

    const overIdStr = String(overId);

    if (overIdStr === HIDDEN_DROPPABLE) {
      if (fromVisible) {
        onVisibleChartsChange(visibleCharts.filter((c) => c !== chart));
      }
      return;
    }

    if (overIdStr === VISIBLE_DROPPABLE) {
      if (!fromVisible && !visibleCharts.includes(chart)) {
        onVisibleChartsChange([...visibleCharts, chart]);
      }
      return;
    }

    const overIsVisibleSortable = visibleCharts.includes(overIdStr);
    const overIsHiddenItem = String(overIdStr).startsWith('hidden-');

    if (overIsVisibleSortable) {
      if (fromVisible) {
        const fromIdx = visibleCharts.indexOf(chart);
        const toIdx = visibleCharts.indexOf(overIdStr);
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          onVisibleChartsChange(arrayMove(visibleCharts, fromIdx, toIdx));
        }
      } else if (!visibleCharts.includes(chart)) {
        const toIdx = visibleCharts.indexOf(overIdStr);
        const next = [...visibleCharts];
        next.splice(toIdx, 0, chart);
        onVisibleChartsChange(next);
      }
      return;
    }

    if (overIsHiddenItem && fromVisible) {
      onVisibleChartsChange(visibleCharts.filter((c) => c !== chart));
    }
  };

  const { setNodeRef: setVisibleRef, isOver: isOverVisible } = useDroppable({
    id: VISIBLE_DROPPABLE,
  });
  const { setNodeRef: setHiddenRef, isOver: isOverHidden } = useDroppable({
    id: HIDDEN_DROPPABLE,
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={chartsCollisionDetection}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          ref={setVisibleRef}
          className={`rounded-xl border p-3 min-h-[140px] transition-colors flex flex-col w-full ${
            isOverVisible
              ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15'
              : 'border-[var(--color-app-accent)]/25 bg-[var(--color-app-accent)]/5'
          }`}
        >
          <div className="text-xs font-semibold text-[var(--color-app-accent)] mb-2 uppercase tracking-wider shrink-0">
            {t('profile.chartsVisible')}
          </div>
          <SortableContext
            items={visibleCharts}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {visibleCharts.map((chart) => (
                <SortableChartItem
                  key={chart}
                  chart={chart}
                  section="visible"
                  isHidden={false}
                  onMoveToHidden={(ch) => onVisibleChartsChange(visibleCharts.filter((c) => c !== ch))}
                  moveToHiddenLabel={t('profile.chartsMoveToHidden')}
                />
              ))}
              {visibleCharts.length === 0 && (
                <div className="py-6 text-center text-xs text-app-muted rounded-lg border border-dashed border-app-subtle">
                  {t('profile.chartsDropHere')}
                </div>
              )}
            </div>
          </SortableContext>
        </div>

        <div
          ref={setHiddenRef}
          className={`rounded-xl border p-3 min-h-[140px] transition-colors flex flex-col w-full ${
            isOverHidden
              ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/10'
              : 'border-white/[0.08] bg-white/[0.02]'
          }`}
        >
          <div className="text-xs font-semibold text-app-muted mb-2 uppercase tracking-wider shrink-0">
            {t('profile.chartsHidden')}
          </div>
            <div className="space-y-1.5">
              {hiddenCharts.map((chart) => (
                <DraggableHiddenItem
                  key={chart}
                  chart={chart}
                  onMoveToVisible={(ch) => onVisibleChartsChange([...visibleCharts, ch])}
                  moveToVisibleLabel={t('profile.chartsMoveToVisible')}
                />
              ))}
              {hiddenCharts.length === 0 && (
                <div className="py-6 text-center text-xs text-app-muted rounded-lg border border-dashed border-app-subtle">
                  {t('profile.chartsAllVisible')}
                </div>
              )}
            </div>
        </div>
      </div>
    </DndContext>
  );
}
