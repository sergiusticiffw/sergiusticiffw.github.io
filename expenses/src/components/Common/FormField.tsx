import React from 'react';
import { useLocalization } from '@context/localization';

export interface FormFieldProps {
  id?: string;
  name: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'url' | 'password';
  label: string;
  value: string | number | null | undefined;
  onChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  required?: boolean;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  isValid?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  required = false,
  placeholder,
  min,
  max,
  step,
  isValid,
  ariaLabel,
  disabled = false,
  className = '',
  autoComplete,
  inputRef,
}) => {
  const { t } = useLocalization();
  const fieldId = id || name;
  
  // Ensure value is never null - convert null/undefined to empty string
  const safeValue = value == null ? '' : value;

  return (
    <div className={`form-group ${required ? 'required' : ''} ${className}`}>
      <label htmlFor={fieldId}>{label}</label>
      <div className="input-wrapper">
        <input
          id={fieldId}
          ref={inputRef}
          type={type}
          name={name}
          value={safeValue}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={ariaLabel || label}
          autoComplete={autoComplete}
          className={`form-input ${isValid ? 'valid' : ''}`}
        />
      </div>
    </div>
  );
};

export default FormField;

