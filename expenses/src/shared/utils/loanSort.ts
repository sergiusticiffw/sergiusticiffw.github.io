/**
 * Loan/payment sort helpers with no imports — breaks indexedDB ↔ utils cycles.
 */

export const processPayments = (payments: any[]): any[] => {
  return payments
    .map((payment: any) => {
      if (!payment.cr && payment.fdt) {
        payment.cr = new Date(payment.fdt).getTime();
      }
      return payment;
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.fdt || 0).getTime();
      const dateB = new Date(b.fdt || 0).getTime();
      const dateComparison = dateB - dateA;

      if (dateComparison !== 0) return dateComparison;

      const crA = a.cr || new Date(a.fdt || 0).getTime();
      const crB = b.cr || new Date(b.fdt || 0).getTime();
      return crB - crA;
    });
};

export const processLoans = (loans: any[]): any[] => {
  return loans
    .map((loan: any) => {
      if (!loan.cr && loan.sdt) {
        loan.cr = new Date(loan.sdt).getTime();
      }
      return loan;
    })
    .sort((a: any, b: any) => {
      const crA = a.cr || (a.sdt ? new Date(a.sdt).getTime() : 0);
      const crB = b.cr || (b.sdt ? new Date(b.sdt).getTime() : 0);
      return crB - crA;
    });
};
