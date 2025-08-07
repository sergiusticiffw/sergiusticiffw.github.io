import React, { useState, useEffect } from 'react';
import { fetchRequest } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { categories, suggestions } from '@utils/constants';
import { notificationType } from '@utils/constants';
import { AuthState, DataState, NodeData } from '@type/types';
import { Plus, Edit, DollarSign, Calendar, Tag, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  formType,
  values,
  onSuccess,
}) => {
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;
  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_category: '',
    field_description: '',
  };
  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuthState() as AuthState;

  // Validation function
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formState.field_amount || parseFloat(formState.field_amount) <= 0) {
      newErrors.field_amount = 'Please enter a valid amount greater than 0';
    }
    
    if (!formState.field_date) {
      newErrors.field_date = 'Please select a date';
    }
    
    if (!formState.field_category) {
      newErrors.field_category = 'Please select a category';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const value = event.target.value;
    setFormState({
      ...formState,
      [event.target.name]: value,
    });
    if (event.target.name === 'field_category') {
      setSuggestionData(suggestions[value as keyof typeof suggestions]);
    }
  };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    const node = {
      type: 'transaction',
      title: [formState.field_date],
      field_amount: [formState.field_amount],
      field_category: [formState.field_category],
      field_date: [formState.field_date],
      field_description: [formState.field_description],
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
          setSuggestionData([]);
          setSelectedIndices([]);
        } else {
          showNotification(
            'Something went wrong, please contact Constantin :)',
            notificationType.ERROR
          );
          setIsSubmitting(false);
        }
      }
    );
  };

  const [suggestionData, setSuggestionData] = useState<string[]>(
    suggestions[formState.field_category as keyof typeof suggestions]
  );
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);

  const handleSuggestionClick = (suggestion: string, index: string) => {
    setFormState({
      ...formState,
      field_description: formState?.field_description
        ? formState.field_description + ` ${suggestion}`
        : suggestion,
    });
    const isSelected = selectedIndices.includes(index);
    if (isSelected) {
      return;
    }
    setSelectedIndices([...selectedIndices, index]);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount Field */}
      <div className="space-y-2">
        <Label htmlFor="field_amount" className="text-sm font-semibold text-foreground">
          Amount <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_amount"
          required
          placeholder="0.00"
          type="number"
          name="field_amount"
          value={formState.field_amount}
          onChange={handleChange}
          min={0}
          step={0.01}
          className={cn(
            "w-full h-11",
            errors.field_amount && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_amount && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_amount}
          </div>
        )}
      </div>
          
      {/* Date Field */}
      <div className="space-y-2">
        <Label htmlFor="field_date" className="text-sm font-semibold text-foreground">
          Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="field_date"
          required
          type="date"
          name="field_date"
          value={formState.field_date}
          onChange={handleChange}
          className={cn(
            "w-full h-11",
            errors.field_date && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {errors.field_date && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_date}
          </div>
        )}
      </div>
          
      {/* Category Field */}
      <div className="space-y-2">
        <Label htmlFor="field_category" className="text-sm font-semibold text-foreground">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formState.field_category || "placeholder"}
          onValueChange={(value) => {
            if (value !== "placeholder") {
              setFormState(prev => ({ ...prev, field_category: value }));
              setSuggestionData(suggestions[value as keyof typeof suggestions]);
            }
          }}
        >
          <SelectTrigger className={cn(
            "w-full h-11",
            errors.field_category && "border-destructive focus-visible:ring-destructive"
          )}>
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="placeholder" disabled>
              Select a category...
            </SelectItem>
            {categories
              .filter(category => category.value !== '')
              .map((category, id) => (
                <SelectItem key={id} value={category.value}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {category.label}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {errors.field_category && (
          <div className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="w-3 h-3" />
            {errors.field_category}
          </div>
        )}
      </div>
          
      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="field_description" className="text-sm font-semibold text-foreground">
          Description
        </Label>
        <Textarea
          id="field_description"
          placeholder="Enter a description for this transaction..."
          name="field_description"
          rows={3}
          value={formState.field_description}
          onChange={handleChange}
          className="w-full resize-none min-h-[80px]"
        />
        <div className="text-xs text-muted-foreground">
          Optional: Add details about this transaction
        </div>
      </div>
        
      {/* Suggestions Section */}
      {suggestionData.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Quick Suggestions
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {suggestionData.map((suggestion, index) => (
              <Button
                key={`${index}-${suggestion}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSuggestionClick(suggestion, `${index}-${suggestion}`);
                }}
                className={cn(
                  "text-xs px-3 py-1.5 h-auto transition-all duration-200 rounded-md",
                  selectedIndices.includes(`${index}-${suggestion}`)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted border-border/50"
                )}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
        
      {/* Submit Button */}
      <div className="pt-4">
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
                {formType === 'add' ? 'Add Transaction' : 'Update Transaction'}
              </span>
            </>
          )}
        </Button>
      </div>
        </form>
  );
};

export default TransactionForm;
