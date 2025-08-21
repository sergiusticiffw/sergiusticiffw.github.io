import React, { useState } from 'react';
import { fetchRequest } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import { getCategories, getSuggestions, categories, suggestions } from '@utils/constants';
import { notificationType } from '@utils/constants';
import { AuthState, DataState, NodeData } from '@type/types';
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
  const showNotification = useNotification();
  const { t } = useLocalization();
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
  const { token } = useAuthState() as AuthState;
  
  // Get localized categories and suggestions
  const localizedCategories = getCategories();
  const localizedSuggestions = getSuggestions();
  
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
      setSuggestionData(localizedSuggestions[value as keyof typeof localizedSuggestions] || []);
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          showNotification(
            formType === 'add' 
              ? t('notification.transactionAdded')
              : t('notification.transactionUpdated'),
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
          setFormState(initialState);
          setSuggestionData([]);
          setSelectedIndices([]);
        } else {
          showNotification(t('error.unknown'), notificationType.ERROR);
          setIsSubmitting(false);
        }
      }
    );
  };

  const [suggestionData, setSuggestionData] = useState<string[]>(
    localizedSuggestions[formState.field_category as keyof typeof localizedSuggestions] || []
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
    <div className="transaction-form-container">
      <div className="form-header">
        <h2>{formType === 'add' ? t('transactionForm.title') : t('transactionForm.editTitle')}</h2>
      </div>
      <form className="transaction-form" onSubmit={handleSubmit}>
        <div className="form-group required">
          <label htmlFor="field_amount">{t('transactionForm.amount')}</label>
          <input
            id="field_amount"
            required
            placeholder={t('transactionForm.amount')}
            type="number"
            name="field_amount"
            value={formState.field_amount}
            onChange={handleChange}
            min={0}
            step={0.01}
          />
        </div>
        
        <div className="form-group required">
          <label htmlFor="field_date">{t('transactionForm.date')}</label>
          <input
            id="field_date"
            required
            type="date"
            name="field_date"
            value={formState.field_date}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group required">
          <label htmlFor="field_category">{t('transactionForm.category')}</label>
          <select
            id="field_category"
            required
            name="field_category"
            value={formState.field_category}
            onChange={handleChange}
          >
            {localizedCategories.map((category, id) => (
              <option key={id} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="field_description">{t('transactionForm.description')}</label>
          <textarea
            id="field_description"
            placeholder={t('transactionForm.description')}
            name="field_description"
            rows={3}
            value={formState.field_description}
            onChange={handleChange}
          />
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
        
        <div className="form-actions">
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
                {formType === 'add' ? t('transactionForm.title') : t('transactionForm.editTitle')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
