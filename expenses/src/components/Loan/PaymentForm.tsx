import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { addOneDay, fetchRequest } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { Plus, Edit, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PaymentFormProps {
  formType: 'add' | 'edit';
  values: {
    nid: string;
    title: string;
    field_date: string;
    field_rate?: number;
    field_pay_installment?: number;
    field_pay_single_fee?: number;
    field_new_recurring_amount?: number;
  };
  onSuccess: () => void;
  startDate?: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  formType,
  values,
  onSuccess,
  startDate,
}) => {
  const { id } = useParams();
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;
  
  const initialState = {
    field_date: new Date().toISOString().slice(0, 10),
    title: '',
    field_rate: '',
    field_pay_installment: '',
    field_pay_single_fee: '',
    field_new_recurring_amount: '',
    field_loan_reference: id,
    field_is_simulated_payment: false,
  };
  
  const initialValues = {
    title: values.title || '',
    field_date: values.field_date || new Date().toISOString().slice(0, 10),
    field_rate: values.field_rate || '',
    field_pay_installment: values.field_pay_installment || '',
    field_pay_single_fee: values.field_pay_single_fee || '',
    field_new_recurring_amount: values.field_new_recurring_amount || '',
    field_loan_reference: id,
    field_is_simulated_payment: values.field_is_simulated_payment || false,
  };
  
  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : initialValues
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { token } = useAuthState() as AuthState;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation function
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formState.title?.trim()) {
      newErrors.title = 'Payment title is required';
    }
    
    if (!formState.field_date) {
      newErrors.field_date = 'Payment date is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : value,
    });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };



  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    const node = {
      type: 'payment',
      title: [formState.title],
      field_date: [formState.field_date],
      field_rate: [formState.field_rate],
      field_pay_installment: [formState.field_pay_installment],
      field_pay_single_fee: [formState.field_pay_single_fee],
      field_new_recurring_amount: [formState.field_new_recurring_amount],
      field_is_simulated_payment: [formState.field_is_simulated_payment ? 1 : 0],
      field_loan_reference: [id],
    };
    const fetchOptions = {
      method: formType === 'add' ? 'POST' : 'PATCH',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': 'Bearer ' + token,
      }),
      body: JSON.stringify(node),
    };
    const url =
      formType === 'add'
        ? 'https://dev-expenses-api.pantheonsite.io/node?_format=json'
        : `https://dev-expenses-api.pantheonsite.io/node/${values.nid}?_format=json`;
    fetchRequest(
      url,
      fetchOptions,
      dataDispatch,
      dispatch,
      (data: NodeData) => {
        if (data.nid) {
          onSuccess();
          showNotification('Success!', notificationType.SUCCESS);
          setIsSubmitting(false);
          setFormState(initialState);
        } else {
          showNotification(
            'Something went wrong, please contact Sergiu S :)',
            notificationType.ERROR
          );
          setIsSubmitting(false);
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Payment Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-sm font-semibold text-foreground">
          Payment Title
        </Label>
        <Input
          id="title"
          name="title"
          type="text"
          placeholder="Enter payment title"
          value={formState.title || ''}
          onChange={handleChange}
          className={cn(
            "h-10",
            errors.title && "border-destructive focus-visible:ring-destructive"
          )}
          required
        />
        {errors.title && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.title}
          </div>
        )}
      </div>

      {/* Payment Date */}
      <div className="space-y-1.5">
        <Label htmlFor="field_date" className="text-sm font-semibold text-foreground">
          Payment Date
        </Label>
        <Input
          id="field_date"
          name="field_date"
          type="date"
          min={addOneDay(startDate)}
          value={formState.field_date || ''}
          onChange={handleChange}
          className={cn(
            "h-10",
            errors.field_date && "border-destructive focus-visible:ring-destructive"
          )}
          required
        />
        {errors.field_date && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_date}
          </div>
        )}
      </div>

      {/* Interest Rate */}
      <div className="space-y-1.5">
        <Label htmlFor="field_rate" className="text-sm font-semibold text-foreground">
          New Interest Rate (%)
        </Label>
        <Input
          id="field_rate"
          name="field_rate"
          type="number"
          placeholder="0.00"
          value={formState.field_rate || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
          className="h-10"
        />
      </div>

      {/* Installment Payment */}
      <div className="space-y-1.5">
        <Label htmlFor="field_pay_installment" className="text-sm font-semibold text-foreground">
          Installment Payment
        </Label>
        <Input
          id="field_pay_installment"
          name="field_pay_installment"
          type="number"
          placeholder="0.00"
          value={formState.field_pay_installment || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
          className="h-10"
        />
      </div>

      {/* New Recurring Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="field_new_recurring_amount" className="text-sm font-semibold text-foreground">
          New Recurring Amount
        </Label>
        <Input
          id="field_new_recurring_amount"
          name="field_new_recurring_amount"
          type="number"
          placeholder="0.00"
          value={formState.field_new_recurring_amount || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
          className="h-10"
        />
      </div>

      {/* Individual Fee */}
      <div className="space-y-1.5">
        <Label htmlFor="field_pay_single_fee" className="text-sm font-semibold text-foreground">
          Individual Fee
        </Label>
        <Input
          id="field_pay_single_fee"
          name="field_pay_single_fee"
          type="number"
          placeholder="0.00"
          value={formState.field_pay_single_fee || ''}
          onChange={handleChange}
          min={0}
          step={0.01}
          className="h-10"
        />
      </div>

      {/* Simulated Payment Checkbox */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="field_is_simulated_payment"
          name="field_is_simulated_payment"
          checked={formState.field_is_simulated_payment || false}
          onChange={handleChange}
          className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
        />
        <Label htmlFor="field_is_simulated_payment" className="text-sm text-muted-foreground">
          Simulated payment (debug loan)
        </Label>
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-background border-t border-border/50 -mx-2 px-2 py-4">
                  <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-[1.02]"
          >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : formType === 'add' ? (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Add Payment
            </>
          ) : (
            <>
              <Edit className="w-5 h-5 mr-2" />
              Update Payment
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default PaymentForm;
