import React from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { DataState } from '@type/types';
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
        <div className="form-group required">
          <label htmlFor="field_amount">{t('incomeForm.amount')}</label>
          <div className="input-wrapper">
            <input
              type="number"
              id="field_amount"
              name="field_amount"
              value={formState.field_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              aria-label={t('incomeForm.amount')}
              className={`form-input ${getFieldValidation('field_amount', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group required">
          <label htmlFor="field_date">{t('incomeForm.date')}</label>
          <div className="input-wrapper">
            <input
              type="date"
              id="field_date"
              name="field_date"
              value={formState.field_date}
              onChange={handleChange}
              required
              aria-label={t('incomeForm.date')}
              className={`form-input ${getFieldValidation('field_date', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group required">
          <label htmlFor="field_description">
            {t('incomeForm.description')}
          </label>
          <div className="input-wrapper">
            <input
              type="text"
              id="field_description"
              name="field_description"
              value={formState.field_description}
              onChange={handleChange}
              required
              aria-label={t('incomeForm.description')}
              className={`form-input ${getFieldValidation('field_description', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

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
