import React, { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@utils/utils';

const AmortizationTable = ({ amortizationSchedule }) => {
  const tableRef = useRef(null);
  const theadRef = useRef(null);
  const stickyHeaderRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const stickyScrollRef = useRef(null);

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
      const shouldShow = rect && rect.bottom <= 0;
      setShowStickyHeader(shouldShow);

      if (shouldShow && scrollContainerRef.current && stickyScrollRef.current) {
        stickyScrollRef.current.scrollLeft =
          scrollContainerRef.current.scrollLeft;
      }
    };

    const handleResize = () => {
      syncColumnWidths();
    };

    const syncScroll = (source, target) => {
      if (target) {
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
            {amortizationSchedule?.map((element, index) => {
              // Check if this is an annual summary row
              if (element.type === 'annual_summary') {
                return (
                  <tr
                    key={`summary-scroll-${element.year}`}
                    className="annual-summary-row annual-summary-total"
                  >
                    <td className="sticky-col">Total {element.year}</td>
                    <td>-</td> {/* Days column, N/A for summary */}
                    <td>-</td> {/* Days column, N/A for summary */}
                    <td>{formatNumber(element.totalPaid)}</td>{' '}
                    {/* Total Paid for the year */}
                    <td>{formatNumber(element.totalPrincipal)}</td>
                    <td>{formatNumber(element.totalInterest)}</td>
                    <td>-</td> {/* Principal remaining, N/A for summary */}
                    <td>{formatNumber(element.totalFees)}</td>
                  </tr>
                );
              }

              // Regular payment row
              return (
                <tr
                  key={element[0] + '-' + index} // Use index as well if dates can repeat for uniqueness
                  data-id={element[0]}
                  className={element[7] ? 'was-payed' : null}
                >
                  <td className="sticky-col">{element[0]}</td>
                  <td>{formatNumber(element[1])}</td>
                  <td>{formatNumber(element[8])}</td>
                  <td>{formatNumber(element[2])}</td>
                  <td>{formatNumber(element[3])}</td>
                  <td>{formatNumber(element[4])}</td>
                  <td>{formatNumber(element[5])}</td>
                  <td>{formatNumber(element[6])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizationTable;
