import React, { useMemo, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLocalization } from '@shared/context/localization';
import { formatNumber } from '@shared/utils/utils';

interface PaymentLog {
  date: string;
  rate: number | string;
  installment: number | string;
  reduction: number | string;
  interest: number | string;
  principal: number | string;
  fee: number | string;
  was_payed?: boolean | null;
  num_days?: number | null;
}

interface AnnualSummary {
  type: 'annual_summary';
  year: string;
  totalPrincipal: number;
  totalInterest: number;
  totalFees: number;
  totalPaid: number;
}

type AmortizationRow = PaymentLog | AnnualSummary;

interface AmortizationTableProps {
  amortizationSchedule: AmortizationRow[];
}

/* Tailwind classes (Etapa 6 – replace amortization-table-* CSS) */
const AMORT_ROOT =
  'w-full relative border border-app-subtle overflow-hidden bg-[var(--color-app-bg)] rounded-none';
const AMORT_HEADER_STICKY =
  'sticky top-0 z-50 bg-[var(--color-app-bg)] border-b border-app-subtle [transform:translateZ(0)]';
const AMORT_HEADER_SPLIT = 'flex w-full';
const AMORT_FIRST_COL_HEADER =
  'shrink-0 bg-[var(--color-app-bg)] border-r border-app-subtle z-[60]';
const AMORT_HEADER_INNER =
  'flex-1 overflow-x-auto overflow-y-hidden overflow-touch min-w-0';
const AMORT_BODY_VIRTUAL =
  'overflow-y-auto overflow-touch relative bg-[var(--color-app-bg)] h-[calc(100vh-350px)] min-h-[500px] max-h-[900px] max-md:h-[calc(100vh-280px)] max-md:min-h-[400px] max-md:max-h-[600px] min-xl:h-[calc(100vh-300px)] min-xl:min-h-[600px] min-xl:max-h-[1000px]';
const AMORT_BODY_SPLIT = 'flex w-full';
const AMORT_FIRST_COL_BODY =
  'shrink-0 sticky left-0 z-20 bg-[var(--color-app-bg)] border-r border-app-subtle';
const AMORT_BODY_HORIZONTAL =
  'flex-1 overflow-x-auto overflow-y-hidden overflow-touch min-w-0';
const AMORT_VIRTUAL_CONTAINER = 'relative min-w-max';
const AMORT_TABLE =
  'w-full border-separate border-spacing-0 min-w-max';
const AMORT_TH =
  'whitespace-nowrap px-3 py-2.5 text-center border-b border-app-subtle text-[var(--color-text-secondary)] font-semibold text-[0.9rem] bg-[var(--color-app-bg)] tracking-wide max-md:px-2.5 max-md:py-2 max-md:text-[0.85rem]';
const AMORT_TD =
  'whitespace-nowrap px-3 py-2.5 text-center border-b border-app-subtle text-[var(--color-text-secondary)] text-[0.9rem] max-md:px-2.5 max-md:py-2 max-md:text-[0.85rem]';
const STICKY_COL_BODY =
  'sticky left-0 z-10 bg-[var(--color-app-bg)] shadow-[2px_0_2px_-1px_rgba(0,0,0,0.3)] min-w-[100px] isolate pl-3 [transform:translateZ(0)]';
const STICKY_COL_HEADER =
  'sticky left-0 z-[30] bg-[var(--color-app-bg)] shadow-[2px_0_2px_-1px_rgba(0,0,0,0.3)] min-w-[100px] isolate pl-3 [transform:translateZ(0)]';
const AMORT_ROW = 'w-full min-w-max';
const AMORT_ROW_TABLE =
  'w-full min-w-max border-separate border-spacing-0 [&_td]:hover:bg-[color-mix(in_srgb,var(--color-app-accent)_8%,transparent)]';
const ROW_ANNUAL_BORDERS = 'border-t border-b border-[var(--color-border-medium)]';
const TD_ANNUAL =
  '!bg-[color-mix(in_srgb,var(--color-app-bg)_85%,black)] font-bold text-[var(--color-text-primary)]';
const TD_ANNUAL_STICKY =
  '!bg-[color-mix(in_srgb,var(--color-app-bg)_85%,black)] font-bold text-[var(--color-text-primary)] z-[11]';
const TD_WAS_PAYED = 'bg-[rgba(30,58,47,0.55)] text-[#d4edda]';
const TD_WAS_PAYED_STICKY = '!bg-[rgba(30,58,47,0.7)] text-[#d4edda] z-[11]';

const AmortizationTable: React.FC<AmortizationTableProps> = ({
  amortizationSchedule,
}) => {
  const { t } = useLocalization();
  const bodyVerticalRef = useRef<HTMLDivElement>(null);
  const bodyHorizontalRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  // Sync horizontal scroll between header (right) and body (right)
  useEffect(() => {
    const body = bodyHorizontalRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      target.scrollLeft = source.scrollLeft;
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onBodyScroll = () => syncScroll(body, header);
    const onHeaderScroll = () => syncScroll(header, body);

    body.addEventListener('scroll', onBodyScroll, { passive: true });
    header.addEventListener('scroll', onHeaderScroll, { passive: true });

    return () => {
      body.removeEventListener('scroll', onBodyScroll);
      header.removeEventListener('scroll', onHeaderScroll);
    };
  }, []);

  // Column definitions
  const columns = useMemo<ColumnDef<AmortizationRow>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'date',
        header: t('amortization.date'),
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return `${t('amortization.total')} ${row.year}`;
          }
          return (row as PaymentLog).date;
        },
      },
      {
        id: 'rate',
        accessorKey: 'rate',
        header: t('amortization.rate'),
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return '-';
          }
          return formatNumber((row as PaymentLog).rate);
        },
      },
      {
        id: 'days',
        accessorKey: 'num_days',
        header: t('amortization.days'),
        size: 80,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return '-';
          }
          return formatNumber((row as PaymentLog).num_days || 0);
        },
      },
      {
        id: 'installment',
        accessorKey: 'installment',
        header: t('amortization.installment'),
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return formatNumber(row.totalPaid);
          }
          return formatNumber((row as PaymentLog).installment);
        },
      },
      {
        id: 'reduction',
        accessorKey: 'reduction',
        header: t('amortization.reduction'),
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return formatNumber(row.totalPrincipal);
          }
          return formatNumber((row as PaymentLog).reduction);
        },
      },
      {
        id: 'interest',
        accessorKey: 'interest',
        header: t('amortization.interest'),
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return formatNumber(row.totalInterest);
          }
          return formatNumber((row as PaymentLog).interest);
        },
      },
      {
        id: 'principal',
        accessorKey: 'principal',
        header: t('amortization.principal'),
        size: 120,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return '-';
          }
          return formatNumber((row as PaymentLog).principal);
        },
      },
      {
        id: 'fee',
        accessorKey: 'fee',
        header: t('amortization.fee'),
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') {
            return formatNumber(row.totalFees);
          }
          return formatNumber((row as PaymentLog).fee);
        },
      },
    ],
    [t]
  );

  // Table instance
  const table = useReactTable({
    data: amortizationSchedule,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const firstHeaderGroup = table.getHeaderGroups()[0];
  const firstHeader = firstHeaderGroup?.headers?.[0];
  const firstColWidth = firstHeader?.getSize?.() ?? 120;

  // Virtualization for rows
  const { getVirtualItems, getTotalSize } = useVirtualizer({
    count: amortizationSchedule.length,
    getScrollElement: () => bodyVerticalRef.current,
    estimateSize: () => 40, // Estimated row height (matches CSS)
    overscan: 5, // Render 5 extra rows outside viewport for smooth scrolling
  });

  const getRowKind = (row: Row<AmortizationRow>): 'annual' | 'was-payed' | '' => {
    const original = row.original;
    if ('type' in original && original.type === 'annual_summary') return 'annual';
    if ('was_payed' in original && original.was_payed) return 'was-payed';
    return '';
  };

  const getRowDivClasses = (row: Row<AmortizationRow>): string => {
    const kind = getRowKind(row);
    return kind === 'annual' ? ROW_ANNUAL_BORDERS : '';
  };

  const getFirstColRowDivClasses = (row: Row<AmortizationRow>): string => {
    const kind = getRowKind(row);
    return kind === 'annual' ? ROW_ANNUAL_BORDERS : '';
  };

  const getTdExtraClasses = (row: Row<AmortizationRow>): string => {
    const kind = getRowKind(row);
    if (kind === 'annual') return TD_ANNUAL;
    if (kind === 'was-payed') return TD_WAS_PAYED;
    return '';
  };

  const getStickyTdExtraClassesFirstCol = (row: Row<AmortizationRow>): string => {
    const kind = getRowKind(row);
    return kind === 'annual' ? TD_ANNUAL_STICKY : '';
  };

  return (
    <div className={AMORT_ROOT}>
      {/* Sticky Header */}
      <div className={AMORT_HEADER_STICKY}>
        <div className={AMORT_HEADER_SPLIT}>
          <div className={AMORT_FIRST_COL_HEADER}>
            <table className={`${AMORT_TABLE} min-w-0`}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.slice(0, 1).map((header) => (
                      <th
                        key={header.id}
                        className={`sticky-col ${STICKY_COL_HEADER} ${AMORT_TH}`}
                        style={{
                          width: firstColWidth,
                          minWidth: firstColWidth,
                          maxWidth: firstColWidth,
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            </table>
          </div>

          <div
            ref={headerScrollRef}
            className={`amort-header-inner ${AMORT_HEADER_INNER}`}
          >
            <table className={AMORT_TABLE}>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.slice(1).map((header) => (
                      <th
                        key={header.id}
                        className={AMORT_TH}
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          maxWidth: header.getSize(),
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            </table>
          </div>
        </div>
      </div>

      <div
        ref={bodyVerticalRef}
        className={`amort-body-virtual ${AMORT_BODY_VIRTUAL}`}
      >
        <div className={AMORT_BODY_SPLIT}>
          <div
            className={AMORT_FIRST_COL_BODY}
            style={{ width: firstColWidth }}
          >
            <div
              className={AMORT_VIRTUAL_CONTAINER}
              style={{
                height: `${getTotalSize()}px`,
                width: firstColWidth,
                position: 'relative',
              }}
            >
              {getVirtualItems().map((virtualRow) => {
                const row = table.getRowModel().rows[virtualRow.index];
                if (!row) return null;
                const cell = row.getVisibleCells()[0];
                if (!cell) return null;

                return (
                  <div
                    key={`${row.id}-first`}
                    className={`${AMORT_ROW} ${getFirstColRowDivClasses(row)}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: firstColWidth,
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <table className={`${AMORT_ROW_TABLE} min-w-0 [&_td]:hover:!bg-[color-mix(in_srgb,var(--color-app-accent)_8%,transparent)]`}>
                      <tbody>
                        <tr>
                          <td
                            className={`sticky-col ${STICKY_COL_BODY} ${AMORT_TD} ${getStickyTdExtraClassesFirstCol(row)}`}
                            style={{
                              width: firstColWidth,
                              minWidth: firstColWidth,
                              maxWidth: firstColWidth,
                            }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={bodyHorizontalRef} className={AMORT_BODY_HORIZONTAL}>
            <div
              className={AMORT_VIRTUAL_CONTAINER}
              style={{
                height: `${getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {getVirtualItems().map((virtualRow) => {
                const row = table.getRowModel().rows[virtualRow.index];
                if (!row) return null;

                return (
                  <div
                    key={row.id}
                    className={`${AMORT_ROW} ${getRowDivClasses(row)}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <table className={AMORT_ROW_TABLE}>
                      <tbody>
                        <tr>
                          {row
                            .getVisibleCells()
                            .slice(1)
                            .map((cell) => (
                              <td
                                key={cell.id}
                                className={`${AMORT_TD} ${getTdExtraClasses(row)}`}
                                style={{
                                  width: cell.column.getSize(),
                                  minWidth: cell.column.getSize(),
                                  maxWidth: cell.column.getSize(),
                                }}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmortizationTable;
