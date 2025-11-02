import React from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { DataState } from '@type/types';
import { FormField } from '@components/Common';
import './IncomeForm.scss';

interface IncomeFormProps {
  formType: 'add' | 'edit';
  values: {
    nid?: string;
    field_amount: string;
    field_date: string;
    field_description: string;
  };
  onSuccess: () => void;
}

const IncomeForm: React.FC<IncomeFormProps> = ({
  formType,
  values,
  onSuccess,
}) => {
  const { t } = useLocalization();
  const { dataDispatch } = useData() as DataState;

  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_description: '',
  };

  const validationRules = {
    field_amount: {
      required: true,
      custom: (value: string) =>
        !isNaN(parseFloat(value)) && parseFloat(value) > 0,
    },
    field_date: {
      required: true,
      custom: (value: string) => new Date(value) <= new Date(),
    },
    field_description: {
      required: true,
    },
  };

  const { getFieldValidation } = useFormValidation(validationRules);

  const { formState, isSubmitting, handleChange, handleSubmit } = useFormSubmit(
    {
      formType,
      initialState,
      values,
      nodeType: 'incomes',
      onSuccess,
      dataDispatch,
      buildNodeData: (state) => ({
        title: [state.field_date],
        field_amount: [state.field_amount],
        field_date: [state.field_date],
        field_description: [state.field_description],
      }),
      successMessageKeys: {
        add: 'notification.incomeAdded',
        edit: 'notification.incomeUpdated',
      },
    }
  );

  return (
    <div className="income-form-container">
      <form className="income-form" onSubmit={handleSubmit}>
        <FormField
          name="field_amount"
          type="number"
          label={t('incomeForm.amount')}
          value={formState.field_amount}
          onChange={handleChange}
          required
          step="0.01"
          min="0"
          isValid={getFieldValidation('field_amount', formState)}
          ariaLabel={t('incomeForm.amount')}
        />

        <FormField
          name="field_date"
          type="date"
          label={t('incomeForm.date')}
          value={formState.field_date}
          onChange={handleChange}
          required
          isValid={getFieldValidation('field_date', formState)}
          ariaLabel={t('incomeForm.date')}
        />

        <FormField
          name="field_description"
          type="text"
          label={t('incomeForm.description')}
          value={formState.field_description}
          onChange={handleChange}
          required
          isValid={getFieldValidation('field_description', formState)}
          ariaLabel={t('incomeForm.description')}
        />

        <div className="form-actions-sticky">
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : formType === 'add' ? (
              t('common.add')
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;
