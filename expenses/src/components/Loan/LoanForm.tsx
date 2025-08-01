import React, { useState } from 'react';
import { useNotification } from '@context/notification';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { AuthState, DataState, NodeData } from '@type/types';
import { fetchRequest, addOneDay } from '@utils/utils';
import { notificationType } from '@utils/constants';
import { FaPlus, FaPen } from 'react-icons/fa';
import './LoanForm.scss';

interface LoanFormProps {
  formType: string;
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

  const { token } = useAuthState() as AuthState;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, type, value } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <div className="loan-form-container">
      <div className="form-header">
        <h2>{formType === 'add' ? 'Add New Loan' : 'Edit Loan'}</h2>
      </div>
      
      <form className="loan-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-group required">
          <label>Loan Title</label>
          <input
            required
            placeholder="Enter loan title"
            type="text"
            name="title"
            value={formState.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>Principal Amount</label>
            <input
              required
              placeholder="0.00"
              type="number"
              name="field_principal"
              value={formState.field_principal}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
          
          <div className="form-group required">
            <label>Interest Rate (%)</label>
            <input
              required
              placeholder="0.00"
              type="number"
              name="field_rate"
              value={formState.field_rate}
              onChange={handleChange}
              min={0}
              step={0.01}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>Start Date</label>
            <input
              required
              type="date"
              name="field_start_date"
              value={formState.field_start_date}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group required">
            <label>End Date</label>
            <input
              required
              type="date"
              name="field_end_date"
              value={formState.field_end_date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Initial Fee (Optional)</label>
          <input
            placeholder="0.00"
            type="number"
            name="field_initial_fee"
            value={formState.field_initial_fee}
            onChange={handleChange}
            min={0}
            step={0.01}
          />
        </div>

        <div className="form-row">
          <div className="form-group required">
            <label>First Payment Date</label>
            <input
              required
              type="date"
              max={formState.field_end_date}
              min={addOneDay(formState.field_start_date)}
              name="field_rec_first_payment_date"
              value={formState.field_rec_first_payment_date}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group required">
            <label>Payment Day of Month</label>
            <input
              required
              placeholder="1-31"
              type="number"
              name="field_recurring_payment_day"
              value={formState.field_recurring_payment_day}
              onChange={handleChange}
              min={1}
              max={31}
            />
          </div>
        </div>

        <div className="form-group required">
          <label>Loan Status</label>
          <select
            required
            name="field_loan_status"
            value={formState.field_loan_status}
            onChange={handleChange}
          >
            {options.map((item, id) => (
              <option key={id} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-submit">
            {isSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : formType === 'add' ? (
              <>
                <FaPlus />
                Add Loan
              </>
            ) : (
              <>
                <FaPen />
                Update Loan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanForm;
