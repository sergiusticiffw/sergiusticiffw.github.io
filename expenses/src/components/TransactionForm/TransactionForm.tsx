import React, { useState } from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { getCategories, getSuggestions } from '@utils/constants';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { DataState } from '@type/types';
import { FaPlus, FaPen } from 'react-icons/fa';
import './TransactionForm.scss';

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
  const { t } = useLocalization();
  const { dataDispatch } = useData() as DataState;

  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_category: '',
    field_description: '',
  };

  // Get localized categories and suggestions
  const localizedCategories = getCategories();
  const localizedSuggestions = getSuggestions();

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
    field_category: {
      required: true,
    },
    field_description: {
      required: true,
    },
  };

  const { getFieldValidation } = useFormValidation(validationRules);

  const {
    formState,
    setFormState,
    isSubmitting,
    handleChange: baseHandleChange,
    handleSubmit,
  } = useFormSubmit({
    formType,
    initialState,
    values,
    nodeType: 'transaction',
    onSuccess,
    dataDispatch,
    buildNodeData: (state) => ({
      title: [state.field_date],
      field_amount: [state.field_amount],
      field_category: [state.field_category],
      field_date: [state.field_date],
      field_description: [state.field_description],
    }),
    successMessageKeys: {
      add: 'notification.transactionAdded',
      edit: 'notification.transactionUpdated',
    },
  });

  const [suggestionData, setSuggestionData] = useState<string[]>(
    localizedSuggestions[
      formState.field_category as keyof typeof localizedSuggestions
    ] || []
  );
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);

  // Extended handleChange with suggestions logic
  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    baseHandleChange(event);
    if (event.target.name === 'field_category') {
      setSuggestionData(
        localizedSuggestions[
          event.target.value as keyof typeof localizedSuggestions
        ] || []
      );
    }
  };

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
    <div className="transaction-form-container">
      <form className="transaction-form" onSubmit={handleSubmit}>
        <div className="form-group required">
          <label htmlFor="field_amount">{t('transactionForm.amount')}</label>
          <div className="input-wrapper">
            <input
              id="field_amount"
              required
              placeholder="0.00"
              type="number"
              name="field_amount"
              value={formState.field_amount}
              onChange={handleChange}
              min={0}
              step={0.01}
              className={`form-input ${getFieldValidation('field_amount', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group required">
          <label htmlFor="field_date">{t('transactionForm.date')}</label>
          <div className="input-wrapper">
            <input
              id="field_date"
              required
              type="date"
              name="field_date"
              value={formState.field_date}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_date', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        <div className="form-group required">
          <label htmlFor="field_category">
            {t('transactionForm.category')}
          </label>
          <div className="input-wrapper">
            <select
              id="field_category"
              required
              name="field_category"
              value={formState.field_category}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_category', formState) ? 'valid' : ''}`}
            >
              <option value="">Select a category...</option>
              {localizedCategories.map((category, id) => (
                <option key={id} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="field_description">
            {t('transactionForm.description')}
          </label>
          <div className="input-wrapper">
            <input
              id="field_description"
              placeholder={t('transactionForm.description')}
              name="field_description"
              type="text"
              value={formState.field_description}
              onChange={handleChange}
              className={`form-input ${getFieldValidation('field_description', formState) ? 'valid' : ''}`}
            />
          </div>
        </div>

        {suggestionData.length ? (
          <div className="form-group">
            <label>{t('suggestions.title')}</label>
            <ul className="suggestions">
              {suggestionData.map((suggestion, index) => (
                <li
                  key={`${index}-${suggestion}`}
                  onClick={() => {
                    handleSuggestionClick(suggestion, `${index}-${suggestion}`);
                  }}
                  className={
                    selectedIndices.includes(`${index}-${suggestion}`)
                      ? 'selected-suggestion'
                      : ''
                  }
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="form-actions-sticky">
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <>
                {formType === 'add' ? <FaPlus /> : <FaPen />}
                <span>
                  {formType === 'add'
                    ? t('transactionForm.title')
                    : t('transactionForm.editTitle')}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
