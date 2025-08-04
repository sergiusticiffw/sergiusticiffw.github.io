import React from 'react';
import { categories } from '@utils/constants';

interface FormFieldProps {
  label: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
  min?: number;
  step?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type,
  value,
  onChange,
  required = false,
  placeholder,
  options = [],
  rows = 3,
  min,
  step
}) => {
  const renderField = () => {
    const commonProps = {
      id: name,
      name,
      value,
      onChange,
      placeholder,
      required,
    };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={rows}
            className="form-textarea"
          />
        );

      case 'select':
        return (
          <select {...commonProps} className="form-select">
            <option value="">Select an option...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            min={min}
            step={step}
            className="form-input"
          />
        );

      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
            className="form-input"
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type="text"
            className="form-input"
          />
        );
    }
  };

  return (
    <div className={`form-group ${required ? 'required' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {renderField()}
    </div>
  );
};

// Specialized form field components
export const AmountField: React.FC<Omit<FormFieldProps, 'type' | 'options'> & { step?: string }> = (props) => (
  <FormField {...props} type="number" step={props.step || "0.01"} min={0} />
);

export const DateField: React.FC<Omit<FormFieldProps, 'type' | 'options'> & { min?: string }> = (props) => (
  <FormField {...props} type="date" />
);

export const CategoryField: React.FC<Omit<FormFieldProps, 'type' | 'options'> & { 
  options?: Array<{ value: string; label: string }> 
}> = (props) => (
  <FormField 
    {...props} 
    type="select" 
    options={props.options || categories.map(cat => ({ value: cat.value, label: cat.label }))}
  />
);

export const DescriptionField: React.FC<Omit<FormFieldProps, 'type' | 'options'> & { rows?: number }> = (props) => (
  <FormField {...props} type="textarea" rows={props.rows || 3} />
);

export default FormField; 