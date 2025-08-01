import React, { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@utils/utils';

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
  const tableRef = useRef<HTMLTableElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const stickyHeaderRef = useRef<HTMLTableElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);

  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const syncColumnWidths = () => {
    if (!theadRef.current || !stickyHeaderRef.current) return;
    const originalThs = theadRef.current.querySelectorAll('th');

    const cloneThs = stickyHeaderRef.current.querySelectorAll('th');

    if (originalThs.length !== cloneThs.length) return;

    for (let i = 0; i < originalThs.length; i++) {
      cloneThs[i].style.width = `${originalThs[i].offsetWidth}px`;
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const rect = theadRef.current?.getBoundingClientRect();
      const shouldShow = rect && rect.bottom <= 50;
      setShowStickyHeader(shouldShow);

      if (shouldShow && scrollContainerRef.current && stickyScrollRef.current) {
        stickyScrollRef.current.scrollLeft =
          scrollContainerRef.current.scrollLeft;
      }
    };

    const handleResize = () => {
      syncColumnWidths();
    };

    const syncScroll = (
      source: HTMLElement | null,
      target: HTMLElement | null
    ) => {
      if (target && source) {
        target.scrollLeft = source.scrollLeft;
      }
    };

    const handleMainScroll = () => {
      syncScroll(scrollContainerRef.current, stickyScrollRef.current);
    };

    const handleStickyScroll = () => {
      syncScroll(stickyScrollRef.current, scrollContainerRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    scrollContainerRef.current?.addEventListener('scroll', handleMainScroll);
    stickyScrollRef.current?.addEventListener('scroll', handleStickyScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      scrollContainerRef.current?.removeEventListener(
        'scroll',
        handleMainScroll
      );
      stickyScrollRef.current?.removeEventListener(
        'scroll',
        handleStickyScroll
      );
    };
  }, []);

  useEffect(() => {
    if (showStickyHeader) {
      syncColumnWidths();
    }
  }, [showStickyHeader]);

  const renderRow = (element: PaymentLog | AnnualSummary, index: number) => {
    // Check if this is an annual summary row
    if ('type' in element && element.type === 'annual_summary') {
      return (
        <tr
          key={`summary-scroll-${element.year}`}
          className="annual-summary-row annual-summary-total"
        >
          <td className="sticky-col">Total {element.year}</td>
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
    <div className="table-wrapper-loan">
      {showStickyHeader && (
        <div className="cloned-thead-wrapper" ref={stickyScrollRef}>
          <table ref={stickyHeaderRef} cellSpacing="0" cellPadding="0">
            <thead>
              <tr>
                <th className="sticky-col">Date</th>
                <th>Rate</th>
                <th>Days</th>
                <th>Installment</th>
                <th>Reduction</th>
                <th>Interest</th>
                <th>Principal</th>
                <th>Fee</th>
              </tr>
            </thead>
          </table>
        </div>
      )}
      {/* Main scrollable table */}
      <div className="horizontal-scroll-wrapper" ref={scrollContainerRef}>
        <table
          ref={tableRef}
          className="amortization-table expenses-table"
          cellSpacing="0"
          cellPadding="0"
        >
          <thead ref={theadRef}>
            <tr>
              <th className="sticky-col first-header-cell">Date</th>
              <th>Rate</th>
              <th>Days</th>
              <th>Installment</th>
              <th>Reduction</th>
              <th>Interest</th>
              <th>Principal</th>
              <th>Fee</th>
            </tr>
          </thead>
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
