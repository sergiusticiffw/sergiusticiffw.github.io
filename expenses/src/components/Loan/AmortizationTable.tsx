import React, { useMemo, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLocalization } from '@context/localization';
import { formatNumber } from '@utils/utils';
import './AmortizationTable.scss';

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
            return '-';
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
            return formatNumber(row.totalPrincipal);
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

  // Get row class name
  const getRowClassName = (row: Row<AmortizationRow>): string => {
    const original = row.original;
    if ('type' in original && original.type === 'annual_summary') {
      return 'annual-summary-row';
    }
    if ('was_payed' in original && original.was_payed) {
      return 'was-payed';
    }
    return '';
  };

  const getFirstColRowClassName = (row: Row<AmortizationRow>): string => {
    const className = getRowClassName(row);
    // Keep annual summaries styling, but don't tint the first column for paid rows
    return className === 'was-payed' ? '' : className;
  };

  return (
    <div className="amortization-table-tanstack">
      {/* Sticky Header */}
      <div className="amortization-table-header-sticky">
        <div className="amortization-table-header-split">
          {/* Left (fixed) header */}
          <div className="amortization-table-first-col-header">
            <table className="amortization-table amortization-table-first-col">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.slice(0, 1).map((header) => (
                      <th
                        key={header.id}
                        className="sticky-col"
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

          {/* Right (scrollable) header */}
          <div ref={headerScrollRef} className="amortization-table-header-inner">
            <table className="amortization-table amortization-table-rest">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.slice(1).map((header) => (
                      <th
                        key={header.id}
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

      {/* Virtualized Body */}
      <div ref={bodyVerticalRef} className="amortization-table-body-virtual">
        <div className="amortization-table-body-split">
          {/* Left (fixed) first column */}
          <div
            className="amortization-table-first-col-body"
            style={{ width: firstColWidth }}
          >
            <div
              className="amortization-table-virtual-container"
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
                    className={`amortization-table-row amortization-table-first-col-row ${getFirstColRowClassName(row)}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: firstColWidth,
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <table className="amortization-table amortization-table-first-col">
                      <tbody>
                        <tr>
                          <td
                            className="sticky-col"
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

          {/* Right (scrollable) rest of columns */}
          <div
            ref={bodyHorizontalRef}
            className="amortization-table-body-horizontal"
          >
            <div
              className="amortization-table-virtual-container"
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
                    className={`amortization-table-row ${getRowClassName(row)}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <table className="amortization-table amortization-table-rest">
                      <tbody>
                        <tr>
                          {row
                            .getVisibleCells()
                            .slice(1)
                            .map((cell) => (
                              <td
                                key={cell.id}
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
