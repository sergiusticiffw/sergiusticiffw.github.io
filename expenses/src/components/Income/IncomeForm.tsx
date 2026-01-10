import React, { useState, useEffect } from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { DataState } from '@type/types';
import { FormField } from '@components/Common';
import { incomeSuggestions, incomeSourceLabels } from '@utils/constants';
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
  hideSubmitButton?: boolean;
  onFormReady?: (submitHandler: () => void, isSubmitting: boolean) => void;
}

const IncomeForm: React.FC<IncomeFormProps> = ({
  formType,
  values,
  onSuccess,
  hideSubmitButton = false,
  onFormReady,
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

  const { formState, isSubmitting, handleChange, handleSubmit, setFormState } =
    useFormSubmit({
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
    });

  // Track selected tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract tags from description on mount or when values change
  useEffect(() => {
    const description = values.field_description || formState.field_description || '';
    if (description) {
      const tags: string[] = [];
      incomeSuggestions.forEach((tag) => {
        if (description.toLowerCase().includes(`#${tag}`)) {
          tags.push(tag);
        }
      });
      setSelectedTags(tags);
    } else {
      setSelectedTags([]);
    }
  }, [values.field_description, formState.field_description]);

  // Handle tag selection
  const handleTagClick = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    setSelectedTags(newSelectedTags);

    // Update description with tags
    let description = formState.field_description || '';
    
    // Remove all existing tags from description
    incomeSuggestions.forEach((t) => {
      const tagPattern = new RegExp(`#${t}\\b`, 'gi');
      description = description.replace(tagPattern, '').trim();
    });

    // Add selected tags
    const tagsToAdd = newSelectedTags.map((t) => `#${t}`).join(' ');
    description = tagsToAdd
      ? description
        ? `${description} ${tagsToAdd}`
        : tagsToAdd
      : description;

    // Update form state
    setFormState({
      ...formState,
      field_description: description,
    });
  };

  // Expose form submit handler and state to parent if needed
  React.useEffect(() => {
    if (onFormReady) {
      onFormReady(() => {
        const form = document.querySelector(
          `.income-form-${formType}`
        ) as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, isSubmitting);
    }
  }, [onFormReady, isSubmitting, formType]);

  return (
    <div className="income-form-container">
      <form
        id={`income-form-${formType}`}
        className={`income-form income-form-${formType}`}
        onSubmit={handleSubmit}
      >
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

        {/* Income Tags */}
        <div className="form-group">
          <label>{t('incomeForm.tags') || 'Income Tags'}</label>
          <div className="tags-container">
            {incomeSuggestions.map((tag) => {
              const label = incomeSourceLabels[tag] || tag;
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className={`tag-chip ${isSelected ? 'selected' : ''}`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>

        {!hideSubmitButton && (
          <div className="form-actions-sticky">
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
            >
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
        )}
      </form>
    </div>
  );
};

export default IncomeForm;
