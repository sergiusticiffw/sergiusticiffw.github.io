import React, { useEffect, useState } from 'react';
import LoanDetails from '@components/Loan/LoanDetails';
import LoanForm from '@components/Loan/LoanForm';
import Paydown from '@utils/paydown-node';
import { useParams } from 'react-router-dom';
import PaymentDetails from '@components/Loan/PaymentDetails';
import PaymentForm from '@components/Loan/PaymentForm';
import { useLoan } from '@context/loan';
import { useAuthDispatch, useAuthState } from '@context/context';
import { AuthState } from '@type/types';
import {
  fetchLoans,
  transformToNumber,
  transformDateFormat,
  formatNumber,
  calculateDaysFrom,
} from '@utils/utils';
import {
  Pen,
  HandCoins,
  TrendingUp,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3,
  Loader2,
} from 'lucide-react';
import Notification from '@components/Notification/Notification';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';

const Loan: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isLoanInfoExpanded, setIsLoanInfoExpanded] = useState(false);
  const { loans } = data;
  const noData = data.loans === null;

  useEffect(() => {
    if (noData) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const loan = loans?.find((item: any) => item.id === id);
  if (!loan)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">
            Loading loan details...
          </span>
        </div>
      </div>
    );

  const [filteredData] =
    data?.payments?.filter(
      (item: any) => item?.loanId === id && item?.data?.length > 0
    ) || [];

  const payments =
    filteredData?.data?.map((item: any) => {
      return {
        isSimulatedPayment: Number(item.fisp),
        date: transformDateFormat(item.fdt),
        ...(item.fr ? { rate: transformToNumber(item.fr) } : {}),
        ...(item.fpi ? { pay_installment: transformToNumber(item.fpi) } : {}),
        ...(item.fpsf ? { pay_single_fee: transformToNumber(item.fpsf) } : {}),
        ...(item.fnra
          ? { recurring_amount: transformToNumber(item.fnra) }
          : {}),
      };
    }) || [];

  const loanData = {
    start_date: transformDateFormat(loan.sdt),
    end_date: transformDateFormat(loan.edt),
    principal: transformToNumber(loan.fp),
    rate: transformToNumber(loan.fr),
    day_count_method: 'act/365' as const,
    ...(loan.fif
      ? {
          initial_fee: transformToNumber(loan.fif),
        }
      : {}),
    ...(loan.pdt && loan.frpd
      ? {
          recurring: {
            first_payment_date: transformDateFormat(loan.pdt),
            payment_day: transformToNumber(loan.frpd),
          },
        }
      : {}),
  };

  const paydown = Paydown();
  const amortizationSchedule: any[] = [];
  let errorMessage: string | undefined;
  let paydownResult: any;

  try {
    paydownResult = paydown.calculate(loanData, payments, amortizationSchedule);
  } catch (err: any) {
    errorMessage = err?.message;
  }

  // Calculate progress and totals
  const totalPrincipal = parseFloat(loan.fp || '0');
  const totalInstallments = paydownResult?.sum_of_installments || 0;
  const totalPaidAmount =
    filteredData?.data?.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.fpi || '0');
    }, 0) || 0;
  const remainingAmount = totalInstallments - totalPaidAmount;
  const progress =
    totalInstallments > 0 ? (totalPaidAmount / totalInstallments) * 100 : 0;

  // Calculate additional values
  const totalInterests = paydownResult?.sum_of_interests || 0;
  const totalFees = paydownResult?.sum_of_fees || 0;
  const daysCalculated = paydownResult?.days_calculated || 0;

  // Calculate additional values from the daily-average table
  const sumOfInterest = totalInterests + (paydownResult?.unpaid_interest || 0);
  const payPerDay = totalInstallments / daysCalculated;
  const interestCostPercentage =
    ((sumOfInterest + totalFees) / totalInstallments) * 100;

  // Calculate days passed and remaining
  const startDateParts = loanData.start_date?.split('.') || [];
  const [day, month, year] =
    startDateParts.length >= 3 ? startDateParts : ['01', '01', '2024'];
  const formattedStartDate = `${year}-${month}-${day}`;
  const daysSince = calculateDaysFrom(formattedStartDate);
  const daysPassed = daysSince > 0 ? Math.min(daysSince, daysCalculated) : 0;
  const daysRemaining = Math.max(daysCalculated - daysPassed, 0);

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{loan?.title}</h1>
          <p className="text-muted-foreground mt-1">
            Loan Details & Payment Tracking
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowEditModal(true)}
            variant="outline"
            className="border-border/50 hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 hover:scale-[1.01] font-medium"
          >
            <Pen className="w-4 h-4 mr-2" />
            Edit Loan
          </Button>
          <Button
            onClick={() => setShowAddPaymentModal(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg shadow-green-500/25 transition-all duration-200 hover:scale-[1.02] font-semibold"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Add Payment
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <Notification message={errorMessage} type="error" />
          </CardContent>
        </Card>
      )}

      {/* Progress Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Total Principal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(totalPrincipal)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Total Installments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(totalInstallments)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-purple-500" />
              Amount Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(totalPaidAmount)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatNumber(remainingAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Payment Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Payment Progress
            </span>
            <span className="text-sm font-medium text-foreground">
              {formatNumber(progress)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Loan Information */}
      <Card className="border-border/50 shadow-lg">
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsLoanInfoExpanded(!isLoanInfoExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Loan Information
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isLoanInfoExpanded ? 'Hide' : 'Show'} details
              </span>
              {isLoanInfoExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        {isLoanInfoExpanded && (
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Principal Amount
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(totalPrincipal)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Interest Rate
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {loan.fr}%
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Total Interests
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(sumOfInterest)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Total Fees
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(totalFees)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Days Calculated
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {daysCalculated}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-yellow-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Days Remaining
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {daysRemaining}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Days Passed
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {daysPassed}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Interest Cost %
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(interestCostPercentage)}%
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-teal-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-teal-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Cost per Day
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(payPerDay)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-pink-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Start Date
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {loan.sdt}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-cyan-500" />
                </div>
                <span className="text-sm text-muted-foreground">End Date</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {loan.edt}
              </span>
            </div>

            {loan.fif && (
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Initial Fee
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatNumber(loan.fif)}
                </span>
              </div>
            )}

            {loan.pdt && (
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-violet-500/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-violet-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    First Payment Date
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {loan.pdt}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Actual End Date
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {paydownResult?.actual_end_date || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-lime-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-lime-500" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Latest Payment Date
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {paydownResult?.latest_payment_date || '-'}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Payment History */}
      <PaymentDetails
        loan={loan}
        payments={filteredData?.data || []}
        totalPaidAmount={totalPaidAmount}
      />

      {/* Amortization Schedule */}
      <LoanDetails
        loanData={loanData}
        loan={loan}
        amortizationSchedule={amortizationSchedule}
        totalPaidAmount={totalPaidAmount}
        paydownResult={paydownResult}
      />

      {/* Edit Loan Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Edit Loan
            </DialogTitle>
            <DialogDescription>
              Update the details for this loan.
            </DialogDescription>
          </DialogHeader>
          <LoanForm
            formType={'edit'}
            values={{
              nid: loan.id,
              title: loan.title,
              field_principal: loan.fp,
              field_start_date: loan.sdt,
              field_end_date: loan.edt,
              field_rate: loan.fr,
              field_initial_fee: loan.fif,
              field_rec_first_payment_date: loan.pdt,
              field_recurring_payment_day: loan.frpd,
              field_loan_status: loan.fls,
            }}
            onSuccess={() => {
              setShowEditModal(false);
              fetchLoans(token, dataDispatch, dispatch);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Payment Modal */}
      <Dialog open={showAddPaymentModal} onOpenChange={setShowAddPaymentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Add New Payment
            </DialogTitle>
            <DialogDescription>
              Add a new payment to this loan.
            </DialogDescription>
          </DialogHeader>
          <PaymentForm
            formType="add"
            values={{
              nid: '',
              title: '',
              field_date: new Date().toISOString().slice(0, 10),
              field_rate: undefined,
              field_pay_installment: undefined,
              field_pay_single_fee: undefined,
              field_new_recurring_amount: undefined,
            }}
            startDate={loan.sdt}
            onSuccess={() => {
              setShowAddPaymentModal(false);
              fetchLoans(token, dataDispatch, dispatch);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Loan;
