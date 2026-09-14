import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
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

const AMORT_ROOT =
  'w-full relative border border-app-subtle overflow-hidden bg-[var(--color-app-bg)] rounded-lg md:rounded-xl';
const AMORT_SCROLL =
  'amort-body-virtual overflow-auto relative bg-[var(--color-app-bg)] h-[calc(100vh-350px)] min-h-[500px] max-h-[900px] max-md:h-[calc(100vh-280px)] max-md:min-h-[400px] max-md:max-h-[600px] min-xl:h-[calc(100vh-300px)] min-xl:min-h-[600px] min-xl:max-h-[1000px] [touch-action:pan-x_pan-y]';
const AMORT_INNER = 'relative w-full min-w-max';
const AMORT_HEADER =
  'sticky top-0 z-40 flex w-full min-w-max border-b border-app-subtle bg-[var(--color-app-bg)]';
const AMORT_TH =
  'box-border overflow-hidden text-ellipsis whitespace-nowrap px-3 py-3 text-[var(--color-text-muted)] font-semibold text-[0.8rem] uppercase tracking-wider bg-[var(--color-app-bg)] max-md:px-2.5 max-md:py-2.5 max-md:text-[0.75rem]';
const AMORT_TD =
  'box-border overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)] text-[0.95rem] tabular-nums border-b border-app-subtle bg-[var(--color-app-bg)] max-md:px-2.5 max-md:py-2 max-md:text-[0.875rem]';
const CELL_ALIGN_FIRST = 'text-left pl-3.5 max-md:pl-3';
const CELL_ALIGN_NUM = 'text-right pr-3.5 max-md:pr-3';
/* Body sticky col — below header (z-40) so Date header stays visible on vertical scroll */
const STICKY_FIRST =
  'sticky left-0 z-20 overflow-hidden border-r border-app-subtle bg-[var(--color-app-bg)] shadow-[6px_0_10px_-4px_rgba(0,0,0,0.55)]';
/* Corner: sticky on both axes, above header row and body cells */
const STICKY_FIRST_HEADER =
  'sticky top-0 left-0 z-50 overflow-hidden border-r border-app-subtle bg-[var(--color-app-bg)] shadow-[6px_0_10px_-4px_rgba(0,0,0,0.55)]';
const ROW_BASE = 'flex w-full min-w-max';
const ROW_ANNUAL = 'border-t border-b border-[var(--color-border-medium)]';
const ROW_WAS_PAYED = 'bg-[#1e3a2f]';
const TD_ANNUAL =
  '!bg-[#141414] font-bold text-[var(--color-text-primary)]';
const TD_WAS_PAYED = '!bg-[#1e3a2f] text-[#d4edda]';
const TD_STICKY_ANNUAL = '!bg-[#141414]';
const TD_STICKY_WAS_PAYED = '!bg-[#1e3a2f]';

function getRowKind(row: Row<AmortizationRow>): 'annual' | 'was-payed' | '' {
  const original = row.original;
  if ('type' in original && original.type === 'annual_summary') return 'annual';
  if ('was_payed' in original && original.was_payed) return 'was-payed';
  return '';
}

function cellToneClass(kind: 'annual' | 'was-payed' | '', sticky = false): string {
  if (kind === 'annual') return sticky ? `${TD_ANNUAL} ${TD_STICKY_ANNUAL}` : TD_ANNUAL;
  if (kind === 'was-payed') {
    return sticky ? `${TD_WAS_PAYED} ${TD_STICKY_WAS_PAYED}` : TD_WAS_PAYED;
  }
  return '';
}

function rowToneClass(kind: 'annual' | 'was-payed' | ''): string {
  if (kind === 'annual') return ROW_ANNUAL;
  if (kind === 'was-payed') return ROW_WAS_PAYED;
  return '';
}

function cellFlexStyle(
  minWidth: number,
  sticky = false,
  kind: 'annual' | 'was-payed' | '' = ''
): React.CSSProperties {
  const toneBg =
    kind === 'was-payed'
      ? '#1e3a2f'
      : kind === 'annual'
        ? '#141414'
        : undefined;

  // Sticky col stays fixed width; others grow to fill desktop width
  if (sticky) {
    return {
      flex: `0 0 ${minWidth}px`,
      width: minWidth,
      minWidth,
      maxWidth: minWidth,
      // Inline opaque bg beats any semi-transparent utility leftover
      backgroundColor: toneBg ?? 'var(--color-app-bg)',
    };
  }
  return {
    flex: `1 0 ${minWidth}px`,
    minWidth,
    ...(toneBg ? { backgroundColor: toneBg } : null),
  };
}

const AmortizationTable: React.FC<AmortizationTableProps> = ({
  amortizationSchedule,
}) => {
  const { t } = useLocalization();

  const columns = useMemo<ColumnDef<AmortizationRow>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'date',
        header: t('amortization.date'),
        size: 128,
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
        size: 88,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') return '-';
          return formatNumber((row as PaymentLog).rate);
        },
      },
      {
        id: 'days',
        accessorKey: 'num_days',
        header: t('amortization.days'),
        size: 72,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') return '-';
          return formatNumber((row as PaymentLog).num_days || 0);
        },
      },
      {
        id: 'installment',
        accessorKey: 'installment',
        header: t('amortization.installment'),
        size: 118,
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
        size: 118,
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
        size: 118,
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
        size: 128,
        cell: (info) => {
          const row = info.row.original;
          if ('type' in row && row.type === 'annual_summary') return '-';
          return formatNumber((row as PaymentLog).principal);
        },
      },
      {
        id: 'fee',
        accessorKey: 'fee',
        header: t('amortization.fee'),
        size: 88,
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

  const table = useReactTable({
    data: amortizationSchedule,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const headerGroup = table.getHeaderGroups()[0];
  const minTableWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (col.size ?? 100), 0),
    [columns]
  );

  return (
    <div className={AMORT_ROOT}>
      <div className={AMORT_SCROLL}>
        <div className={AMORT_INNER} style={{ minWidth: minTableWidth }}>
          <div
            role="row"
            className={AMORT_HEADER}
            style={{ minWidth: minTableWidth }}
          >
            {headerGroup?.headers.map((header, index) => {
              const sticky = index === 0;
              const align = sticky ? CELL_ALIGN_FIRST : CELL_ALIGN_NUM;
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  className={`${AMORT_TH} ${align} ${sticky ? STICKY_FIRST_HEADER : ''}`}
                  style={cellFlexStyle(header.getSize(), sticky)}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </div>
              );
            })}
          </div>

          <div
            role="rowgroup"
            className="relative w-full"
            style={{ minWidth: minTableWidth }}
          >
            {rows.map((row) => {
              const kind = getRowKind(row);
              return (
                <div
                  key={row.id}
                  role="row"
                  className={`${ROW_BASE} ${rowToneClass(kind)}`}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const sticky = index === 0;
                    const align = sticky ? CELL_ALIGN_FIRST : CELL_ALIGN_NUM;
                    return (
                      <div
                        key={cell.id}
                        role="cell"
                        className={`${AMORT_TD} ${align} ${sticky ? STICKY_FIRST : ''} ${cellToneClass(kind, sticky)}`}
                        style={cellFlexStyle(cell.column.getSize(), sticky, kind)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmortizationTable;
