import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { fetchRequest, addOneDay } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { Plus, Edit, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface LoanFormProps {
  formType: 'add' | 'edit';
  values: {
    nid: string;
    title: string;
    field_principal: number;
    field_start_date: string;
    field_end_date: string;
    field_rate: number;
    field_initial_fee?: number;
    field_recurring_payment_method?: string;
    field_rec_first_payment_date?: string;
    field_recurring_payment_day?: number;
    field_loan_status?: string;
  };
  onSuccess: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ formType, values, onSuccess }) => {
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;

  const initialState = {
    title: '',
    field_principal: '',
    field_start_date: new Date().toISOString().slice(0, 10),
    field_end_date: new Date().toISOString().slice(0, 10),
    field_rate: '',
    field_initial_fee: '',
    field_rec_first_payment_date: null,
    field_recurring_payment_day: '',
    field_loan_status: 'draft',
  };

  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { token } = useAuthState() as AuthState;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState({
      ...formState,
      [name]: value,
    });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState({
      ...formState,
      [name]: value,
    });
    // Clear error when user selects an option
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formState.title.trim()) {
      newErrors.title = 'Loan title is required';
    }

    if (!formState.field_principal || parseFloat(formState.field_principal) <= 0) {
      newErrors.field_principal = 'Principal amount must be greater than 0';
    }

    if (!formState.field_start_date) {
      newErrors.field_start_date = 'Start date is required';
    }

    if (!formState.field_end_date) {
      newErrors.field_end_date = 'End date is required';
    }

    if (!formState.field_rate || parseFloat(formState.field_rate) < 0) {
      newErrors.field_rate = 'Interest rate must be 0 or greater';
    }

    if (!formState.field_rec_first_payment_date) {
      newErrors.field_rec_first_payment_date = 'First payment date is required';
    }

    if (!formState.field_recurring_payment_day || parseInt(formState.field_recurring_payment_day) < 1 || parseInt(formState.field_recurring_payment_day) > 31) {
      newErrors.field_recurring_payment_day = 'Payment day must be between 1 and 31';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);

    const node = {
      type: 'loan',
      title: [formState.title],
      field_principal: [formState.field_principal],
      field_start_date: [formState.field_start_date],
      field_end_date: [formState.field_end_date],
      field_rate: [formState.field_rate],
      field_initial_fee: [formState.field_initial_fee],
      field_rec_first_payment_date: [formState.field_rec_first_payment_date],
      field_recurring_payment_day: [formState.field_recurring_payment_day],
      field_loan_status: [formState.field_loan_status],
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

  const options = [
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Loan Title Field */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-sm font-semibold text-foreground">
          Loan Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          required
          placeholder="Enter loan title"
          type="text"
          name="title"
          value={formState.title}
          onChange={handleChange}
          className={cn(
            "w-full h-10",
            errors.title && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.title && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.title}
          </div>
        )}
      </div>

      {/* Principal Amount Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_principal" className="text-sm font-semibold text-foreground">
          Principal Amount <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_principal"
          required
          placeholder="0.00"
          type="number"
          name="field_principal"
          value={formState.field_principal}
          onChange={handleChange}
          min={0}
          step={0.01}
          className={cn(
            "w-full h-10",
            errors.field_principal && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_principal && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_principal}
          </div>
        )}
      </div>

      {/* Interest Rate Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_rate" className="text-sm font-semibold text-foreground">
          Interest Rate (%) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_rate"
          required
          placeholder="0.00"
          type="number"
          name="field_rate"
          value={formState.field_rate}
          onChange={handleChange}
          min={0}
          step={0.01}
          className={cn(
            "w-full h-10",
            errors.field_rate && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_rate && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_rate}
          </div>
        )}
      </div>

      {/* Start Date Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_start_date" className="text-sm font-semibold text-foreground">
          Start Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_start_date"
          required
          type="date"
          name="field_start_date"
          value={formState.field_start_date}
          onChange={handleChange}
          className={cn(
            "w-full h-10",
            errors.field_start_date && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_start_date && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_start_date}
          </div>
        )}
      </div>

      {/* End Date Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_end_date" className="text-sm font-semibold text-foreground">
          End Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_end_date"
          required
          type="date"
          name="field_end_date"
          value={formState.field_end_date}
          onChange={handleChange}
          className={cn(
            "w-full h-10",
            errors.field_end_date && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_end_date && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_end_date}
          </div>
        )}
      </div>

      {/* Initial Fee Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_initial_fee" className="text-sm font-semibold text-foreground">
          Initial Fee (Optional)
        </Label>
        <Input
          id="field_initial_fee"
          placeholder="0.00"
          type="number"
          name="field_initial_fee"
          value={formState.field_initial_fee}
          onChange={handleChange}
          min={0}
          step={0.01}
          className="w-full h-10"
        />
      </div>

      {/* First Payment Date Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_rec_first_payment_date" className="text-sm font-semibold text-foreground">
          First Payment Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_rec_first_payment_date"
          required
          type="date"
          max={formState.field_end_date}
          min={addOneDay(formState.field_start_date)}
          name="field_rec_first_payment_date"
          value={formState.field_rec_first_payment_date}
          onChange={handleChange}
          className={cn(
            "w-full h-10",
            errors.field_rec_first_payment_date && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_rec_first_payment_date && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_rec_first_payment_date}
          </div>
        )}
      </div>

      {/* Payment Day Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_recurring_payment_day" className="text-sm font-semibold text-foreground">
          Payment Day of Month <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_recurring_payment_day"
          required
          placeholder="1-31"
          type="number"
          name="field_recurring_payment_day"
          value={formState.field_recurring_payment_day}
          onChange={handleChange}
          min={1}
          max={31}
          className={cn(
            "w-full h-10",
            errors.field_recurring_payment_day && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_recurring_payment_day && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_recurring_payment_day}
          </div>
        )}
      </div>

      {/* Loan Status Field */}
      <div className="space-y-1.5">
        <Label htmlFor="field_loan_status" className="text-sm font-semibold text-foreground">
          Loan Status <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formState.field_loan_status}
          onValueChange={(value) => handleSelectChange('field_loan_status', value)}
        >
          <SelectTrigger className={cn(
            "w-full h-10",
            errors.field_loan_status && "border-destructive focus-visible:ring-destructive"
          )}>
            <SelectValue placeholder="Select loan status" />
          </SelectTrigger>
          <SelectContent>
            {options.map((item, id) => (
              <SelectItem key={id} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.field_loan_status && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_loan_status}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-4 sticky bottom-0 bg-background border-t border-border/50 -mx-2 px-2 py-4">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-[1.02]"
          size="lg"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <>
              {formType === 'add' ? <Plus className="w-5 h-5 mr-2" /> : <Edit className="w-5 h-5 mr-2" />}
              <span className="font-medium">
                {formType === 'add' ? 'Add Loan' : 'Update Loan'}
              </span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default LoanForm;
