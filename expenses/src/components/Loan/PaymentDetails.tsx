import React, { useState } from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { AuthState } from '@type/types';
import { deleteNode, fetchLoans } from '@utils/utils';
import { notificationType } from '@utils/constants';
import PaymentForm from '@components/Loan/PaymentForm';
import PaymentsTable from '@components/Loan/PaymentsTable';
import { useLoan } from '@context/loan';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, DollarSign, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PaymentDetails = (props) => {
  const payments = props?.payments ?? [];
  const loan = props?.loan ?? {};
  const showNotification = useNotification();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [focusedItem, setFocusedItem] = useState({
    nid: '',
    title: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_rate: undefined as number | undefined,
    field_pay_installment: undefined as number | undefined,
    field_pay_single_fee: undefined as number | undefined,
    field_new_recurring_amount: undefined as number | undefined,
    field_is_simulated_payment: false,
  });
  const [deleteModalId, setDeleteModalId] = useState<string | false>(false);

  const handleEdit = (payment: any) => {
    setFocusedItem({
      nid: payment.id,
      title: payment.title,
      field_date: payment.fdt,
      field_rate: payment.fr ? Number(payment.fr) : undefined,
      field_pay_installment: payment.fpi ? Number(payment.fpi) : undefined,
      field_pay_single_fee: payment.fpsf ? Number(payment.fpsf) : undefined,
      field_new_recurring_amount: payment.fnra
        ? Number(payment.fnra)
        : undefined,
      field_is_simulated_payment: Boolean(Number(payment.fisp)),
    });
    setShowEditModal(true);
    setIsNewModal(false);
  };

  const handleDelete = (paymentId: string) => {
    setIsSubmitting(true);
    deleteNode(paymentId, token, (response) => {
      if (response.ok) {
        showNotification(
          'Payment was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
        setIsSubmitting(false);
      }
      setDeleteModalId(false);
      fetchLoans(token, dataDispatch, dispatch);
    });
  };

  const handleDeleteClick = (payment: any) => {
    setDeleteModalId(payment.id);
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      <Dialog
        open={!!deleteModalId}
        onOpenChange={() => setDeleteModalId(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Delete Payment
            </DialogTitle>
            <DialogDescription className="text-center">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Button
              onClick={() => handleDelete(deleteModalId as string)}
              variant="destructive"
              size="lg"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </div>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Payment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowEditModal(false);
            setIsNewModal(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {!isNewModal ? 'Edit Payment' : 'Add New Payment'}
            </DialogTitle>
            <DialogDescription>
              {!isNewModal
                ? 'Update the payment details.'
                : 'Add a new payment to this loan.'}
            </DialogDescription>
          </DialogHeader>
          <PaymentForm
            formType={!isNewModal ? 'edit' : 'add'}
            values={focusedItem}
            startDate={loan.sdt}
            onSuccess={() => {
              setIsNewModal(false);
              setShowEditModal(false);
              fetchLoans(token, dataDispatch, dispatch);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Payment History Table */}
      {payments.length > 0 ? (
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentsTable
              payments={payments}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-lg">
          <CardContent className="text-center py-16">
            <div className="space-y-4">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Payments Yet
                </h3>
                <p className="text-muted-foreground">
                  Start by adding your first payment to track your loan
                  progress.
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowEditModal(true);
                  setIsNewModal(true);
                  setFocusedItem({
                    nid: '',
                    title: '',
                    field_date: new Date().toISOString().slice(0, 10),
                    field_rate: undefined,
                    field_pay_installment: undefined,
                    field_pay_single_fee: undefined,
                    field_new_recurring_amount: undefined,
                    field_is_simulated_payment: false,
                  });
                }}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentDetails;
