import React, { useState } from 'react';
import { fetchRequest } from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { notificationType } from '@utils/constants';
import { AuthState, DataState, NodeData } from '@type/types';
import { FaPlus, FaPen } from 'react-icons/fa';
import './IncomeForm.scss';

interface IncomeFormProps {
  formType: string;
  values: {
    nid: string;
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
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData() as DataState;
  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_description: '',
  };
  const [formState, setFormState] = useState(
    formType === 'add' ? initialState : values
  );
  const { token } = useAuthState() as AuthState;
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setFormState({
      ...formState,
      [event.target.name]: value,
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const node = {
      type: 'incomes',
      title: [formState.field_date],
      field_amount: [formState.field_amount],
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
    <div className="income-form-container">
      <div className="form-header">
        <h2>{formType === 'add' ? 'Add Income' : 'Edit Income'}</h2>
      </div>
      <form className="income-form" onSubmit={handleSubmit}>
        <div className="form-group required">
          <label htmlFor="field_amount">Amount</label>
          <input
            id="field_amount"
            required
            placeholder="Enter amount..."
            type="number"
            name="field_amount"
            value={formState.field_amount}
            onChange={handleChange}
            step="0.01"
            min="0"
          />
        </div>
        
        <div className="form-group required">
          <label htmlFor="field_date">Date</label>
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
          <label htmlFor="field_description">Description</label>
          <textarea
            id="field_description"
            required
            placeholder="Enter description..."
            name="field_description"
            value={formState.field_description}
            onChange={handleChange}
            rows={3}
          />
        </div>
        
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
                {formType === 'add' ? 'Add Income' : 'Update Income'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;
