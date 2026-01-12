import React from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { useFormSubmit } from '@hooks/useFormSubmit';
import { useFormValidation } from '@hooks/useFormValidation';
import { useTags } from '@hooks/useTags';
import { DataState } from '@type/types';
import { FormField } from '@components/Common';
import TagChips from '@components/Common/TagChips';
import { incomeSuggestions } from '@utils/constants';
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

  // Use tags hook for tag management
  const { selectedTags, handleTagClick: handleTagClickInternal, isTagSelected } = useTags({
    suggestions: incomeSuggestions,
    description: formState.field_description,
    formType,
  });

  // Handle tag click and update form state
  const handleTagClick = (tag: string) => {
    const newDescription = handleTagClickInternal(tag);
    setFormState({
      ...formState,
      field_description: newDescription,
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
        <TagChips
          suggestions={incomeSuggestions}
          selectedTags={selectedTags}
          onTagClick={handleTagClick}
          isTagSelected={isTagSelected}
          getTagLabel={(tag) => t(`income.tags.${tag}`) || tag}
          translationKey="incomeForm.tags"
        />

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
