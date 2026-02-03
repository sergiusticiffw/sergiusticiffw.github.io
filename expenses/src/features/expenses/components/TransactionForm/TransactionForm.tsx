import { useState, useEffect, useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { getCategories, getSuggestions } from '@shared/utils/constants';
import { getSuggestionTranslationKey } from '@shared/utils/utils';
import { useFormSubmit } from '@shared/hooks/useFormSubmit';
import { useFormValidation } from '@shared/hooks/useFormValidation';
import { useTags, normalizeTag } from '@shared/hooks/useTags';
import { FormField } from '@shared/components/Common';
import TagChips from '@shared/components/Common/TagChips';
import { FiPlus, FiEdit2, FiCamera } from 'react-icons/fi';

interface TransactionFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
  hideSubmitButton?: boolean;
  onFormReady?: (submitHandler: () => void, isSubmitting: boolean) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  formType,
  values,
  onSuccess,
  hideSubmitButton = false,
  onFormReady,
}) => {
  const { t } = useLocalization();
  const { dataDispatch } = useExpenseData();

  const initialState = {
    field_amount: '',
    field_date: new Date().toISOString().slice(0, 10),
    field_category: '',
    field_description: '',
  };

  // Get localized categories
  const localizedCategories = getCategories();

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

  // Get suggestions for current category (memoized to prevent infinite loops)
  const category = formState.field_category || values.field_category || '';
  const categorySuggestions = useMemo(() => {
    if (!category) return [];
    const suggestions = getSuggestions();
    return suggestions[category as keyof typeof suggestions] || [];
  }, [category]);

  // Use tags hook for tag management
  const {
    selectedTags,
    handleTagClick: handleTagClickInternal,
    isTagSelected,
  } = useTags({
    suggestions: categorySuggestions,
    description: formState.field_description,
    formType,
    normalizeTag,
  });

  // Create display map for normalized tags
  const tagDisplayMap: Record<string, string> = {};
  categorySuggestions.forEach((suggestion) => {
    const normalized = normalizeTag(suggestion);
    tagDisplayMap[normalized] = suggestion;
  });

  // Extended handleChange
  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    baseHandleChange(event);
  };

  // Handle tag click and update form state
  const handleTagClick = (tag: string) => {
    const newDescription = handleTagClickInternal(tag);
    setFormState({
      ...formState,
      field_description: newDescription,
    });
  };

  // Get translated label for suggestion
  const getSuggestionLabel = (suggestion: string): string => {
    const translationKey = getSuggestionTranslationKey(suggestion, category);
    const translated = t(translationKey);
    // If translation key doesn't exist, return original suggestion
    return translated !== translationKey ? translated : suggestion;
  };

  // Expose form submit handler and state to parent if needed
  useEffect(() => {
    if (onFormReady) {
      onFormReady(() => {
        const form = document.querySelector(
          `.transaction-form-${formType}`
        ) as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, isSubmitting);
    }
  }, [onFormReady, isSubmitting, formType]);

  return (
    <div className="transaction-form-container">
      <form
        id={`transaction-form-${formType}`}
        className={`transaction-form transaction-form-${formType}`}
        onSubmit={handleSubmit}
      >
        <FormField
          name="field_amount"
          type="number"
          label={t('transactionForm.amount')}
          value={formState.field_amount}
          onChange={handleChange}
          required
          placeholder={t('form.amountPlaceholder')}
          min={0}
          step={0.01}
          isValid={getFieldValidation('field_amount', formState)}
          ariaLabel={t('transactionForm.amount')}
        />

        <FormField
          name="field_date"
          type="date"
          label={t('transactionForm.date')}
          value={formState.field_date}
          onChange={handleChange}
          required
          isValid={getFieldValidation('field_date', formState)}
          ariaLabel={t('transactionForm.date')}
        />
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
              aria-label={t('transactionForm.category')}
              className={`form-input ${getFieldValidation('field_category', formState) ? 'valid' : ''}`}
            >
              <option value="">{t('form.selectCategory')}</option>
              {localizedCategories.map((category, id) => (
                <option key={id} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <FormField
          name="field_description"
          type="text"
          label={t('transactionForm.description')}
          value={formState.field_description}
          onChange={handleChange}
          placeholder={t('transactionForm.description')}
          isValid={getFieldValidation('field_description', formState)}
          ariaLabel={t('transactionForm.description')}
        />

        {/* Transaction Tags */}
        <TagChips
          suggestions={categorySuggestions}
          selectedTags={selectedTags}
          onTagClick={handleTagClick}
          isTagSelected={isTagSelected}
          getTagLabel={getSuggestionLabel}
          normalizeTag={normalizeTag}
          translationKey="suggestions.title"
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
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <>
                  {formType === 'add' ? <FiPlus /> : <FiEdit2 />}
                  <span>
                    {formType === 'add'
                      ? t('transactionForm.title')
                      : t('transactionForm.editTitle')}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default TransactionForm;
