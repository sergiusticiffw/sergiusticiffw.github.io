import React, { useCallback, useEffect, useRef } from 'react';
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

interface AmortizationTableProps {
  amortizationSchedule: (PaymentLog | AnnualSummary)[];
}

const AmortizationTable: React.FC<AmortizationTableProps> = ({
  amortizationSchedule,
}) => {
  const { t } = useLocalization();

  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const syncScrollLeft = useCallback(
    (source: HTMLDivElement | null, target: HTMLDivElement | null) => {
      if (!source || !target) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      target.scrollLeft = source.scrollLeft;
      // next frame unlock
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    },
    []
  );

  useEffect(() => {
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    if (!body || !header) return;

    const onBodyScroll = () => syncScrollLeft(body, header);
    const onHeaderScroll = () => syncScrollLeft(header, body);

    body.addEventListener('scroll', onBodyScroll, { passive: true });
    header.addEventListener('scroll', onHeaderScroll, { passive: true });

    // initial sync
    header.scrollLeft = body.scrollLeft;

    return () => {
      body.removeEventListener('scroll', onBodyScroll);
      header.removeEventListener('scroll', onHeaderScroll);
    };
  }, [syncScrollLeft]);

  const colWidths = [
    120, // date
    100, // rate
    80, // days
    120, // installment
    120, // reduction
    120, // interest
    120, // principal
    100, // fee
  ];

  const ColGroup = () => (
    <colgroup>
      {colWidths.map((w, i) => (
        <col key={i} style={{ width: `${w}px` }} />
      ))}
    </colgroup>
  );

  const renderRow = (element: PaymentLog | AnnualSummary, index: number) => {
    // Check if this is an annual summary row
    if ('type' in element && element.type === 'annual_summary') {
      return (
        <tr
          key={`summary-scroll-${element.year}`}
          className="annual-summary-row annual-summary-total"
        >
          <td className="sticky-col">
            {t('amortization.total')} {element.year}
          </td>
          <td>-</td>
          <td>-</td>
          <td>{formatNumber(element.totalPaid)}</td>
          <td>{formatNumber(element.totalPrincipal)}</td>
          <td>{formatNumber(element.totalInterest)}</td>
          <td>-</td>
          <td>{formatNumber(element.totalFees)}</td>
        </tr>
      );
    }

    // Regular payment row (PaymentLog object)
    const payment = element as PaymentLog;
    return (
      <tr
        key={payment.date + '-' + index}
        data-id={payment.date}
        className={payment.was_payed ? 'was-payed' : undefined}
      >
        <td className="sticky-col">{payment.date}</td>
        <td>{formatNumber(payment.rate)}</td>
        <td>{formatNumber(payment.num_days || 0)}</td>
        <td>{formatNumber(payment.installment)}</td>
        <td>{formatNumber(payment.reduction)}</td>
        <td>{formatNumber(payment.interest)}</td>
        <td>{formatNumber(payment.principal)}</td>
        <td>{formatNumber(payment.fee)}</td>
      </tr>
    );
  };

  return (
    <div className="amortization-table-shell">
      {/* Sticky header (NOT inside horizontal overflow container) */}
      <div className="amortization-table-header" aria-hidden="true">
        <div className="amortization-table-header-scroll" ref={headerScrollRef}>
          <table
            className="amortization-table expenses-table"
            cellSpacing="0"
            cellPadding="0"
          >
            <ColGroup />
            <thead>
              <tr>
                <th className="sticky-col first-header-cell">
                  {t('amortization.date')}
                </th>
                <th>{t('amortization.rate')}</th>
                <th>{t('amortization.days')}</th>
                <th>{t('amortization.installment')}</th>
                <th>{t('amortization.reduction')}</th>
                <th>{t('amortization.interest')}</th>
                <th>{t('amortization.principal')}</th>
                <th>{t('amortization.fee')}</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* Body (horizontal scroll lives here) - NO thead, only sticky header above */}
      <div className="amortization-table-body-scroll" ref={bodyScrollRef}>
        <table
          className="amortization-table expenses-table"
          cellSpacing="0"
          cellPadding="0"
        >
          <ColGroup />
          <tbody>
            {amortizationSchedule?.map((element, index) =>
              renderRow(element, index)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizationTable;
