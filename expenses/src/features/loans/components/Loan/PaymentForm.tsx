import React from 'react';
import { useLocalization } from '@shared/context/localization';
import { useFormSubmit } from '@shared/hooks/useFormSubmit';
import { useFormValidation } from '@shared/hooks/useFormValidation';
import { useParams } from '@tanstack/react-router';
import { FormField, Loader } from '@shared/components/Common';
import { Switch } from '@shared/ui';
import { BTN_SUBMIT_CLASS } from '@shared/utils/layoutClasses';
import { localTodayString } from '@shared/utils/localDate';
import { useLoan } from '@shared/context/loan';
import { isEarlyPaymentByTitle } from '@features/loans/utils/paymentClassification';

interface PaymentFormProps {
  formType: 'add' | 'edit';
  values: any;
  onSuccess: () => void;
  startDate?: string;
  endDate?: string;
  hideSubmitButton?: boolean;
  onFormReady?: (submitHandler: () => void, isSubmitting: boolean) => void;
}

/**
 * What the user is recording. Only changes which fields are shown; the
 * saved fields are the same as before. "Extra" also sets an early-payment
 * title keyword, which the existing classification logic reads.
 */
type PaymentIntent = 'regular' | 'extra' | 'rate_change';

const INTENT_FIELDS: Record<PaymentIntent, string[]> = {
  regular: ['field_pay_installment', 'field_pay_single_fee'],
  extra: ['field_pay_installment', 'field_pay_single_fee'],
  // New rate, installment, principal or payment method. The engine treats
  // all of these as the same kind of event, so they share one option.
  rate_change: [
    'field_rate',
    'field_new_recurring_amount',
    'field_new_principal',
    'field_payment_method',
    'field_pay_installment',
    'field_pay_single_fee',
  ],
};

const ALL_INTENT_FIELDS = [
  'field_rate',
  'field_new_recurring_amount',
  'field_new_principal',
  'field_payment_method',
  'field_pay_installment',
  'field_pay_single_fee',
];

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && value !== '' && value !== false;

/**
 * Picks the intent that shows every field already filled on an existing
 * payment, so editing never hides a value that would then be cleared on save.
 */
const deriveIntent = (v: Record<string, unknown>): PaymentIntent => {
  if (
    hasValue(v.field_rate) ||
    hasValue(v.field_new_recurring_amount) ||
    hasValue(v.field_new_principal) ||
    hasValue(v.field_payment_method)
  ) {
    return 'rate_change';
  }
  if (Boolean(Number(v.field_is_early_payment ?? 0))) return 'extra';
  if (isEarlyPaymentByTitle(String(v.title ?? ''))) return 'extra';
  return 'regular';
};

const PaymentForm: React.FC<PaymentFormProps> = ({
  formType,
  values,
  onSuccess,
  startDate,
  endDate,
  hideSubmitButton = false,
  onFormReady,
}) => {
  const { id } = useParams({ from: '/expenses/loan/$id' });
  const { t } = useLocalization();
  const { dataDispatch } = useLoan();

  const initialState = {
    field_date: localTodayString(),
    title: '',
    field_rate: '',
    field_pay_installment: '',
    field_pay_single_fee: '',
    field_new_recurring_amount: '',
    field_new_principal: '',
    field_payment_method: '',
    field_loan_reference: id,
    field_is_simulated_payment: false,
    field_is_early_payment: false,
    field_intent: 'regular' as PaymentIntent,
  };

  const initialValues = {
    title: values.title || '',
    field_date: values.field_date || localTodayString(),
    field_rate: values.field_rate || '',
    field_pay_installment: values.field_pay_installment || '',
    field_pay_single_fee: values.field_pay_single_fee || '',
    field_new_recurring_amount: values.field_new_recurring_amount || '',
    field_new_principal: values.field_new_principal || '',
    field_payment_method: values.field_payment_method || '',
    field_loan_reference: id,
    // Coerce to a real boolean (avoid truthy strings like "0")
    field_is_simulated_payment: Boolean(
      Number(values.field_is_simulated_payment ?? 0)
    ),
    field_is_early_payment: Boolean(
      Number(values.field_is_early_payment ?? 0)
    ),
    field_intent: deriveIntent(values),
  };

  const validationRules = {
    title: { required: true },
    field_date: {
      required: true,
      custom: (value: any) => {
        if (!value) return false;
        if (!startDate || !endDate) return true; // Skip validation if dates not provided
        const date = new Date(value);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return date >= start && date <= end;
      },
    },
    field_rate: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_pay_installment: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_pay_single_fee: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_new_recurring_amount: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num > 0;
      },
    },
    field_new_principal: {
      required: false,
      custom: (value: any) => {
        if (!value) return false;
        const strValue = String(value).trim();
        if (strValue === '') return false;
        const num = parseFloat(strValue);
        return !isNaN(num) && num >= 0;
      },
    },
  };

  const { getFieldValidation } = useFormValidation(validationRules);

  const {
    formState,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFormState,
  } = useFormSubmit({
    formType,
    initialState: formType === 'add' ? initialState : initialValues,
    values,
    nodeType: 'payment',
    onSuccess,
    dataDispatch,
    useFetchRequest: false,
    additionalParams: { loanId: id },
    buildNodeData: (state) => {
      // Extra payments must carry the early-payment keyword to be classified as such.
      const title =
        state.field_intent === 'extra' && !isEarlyPaymentByTitle(state.title)
          ? `${t('paymentForm.extraTitle')}: ${state.title}`
          : state.title;

      const nodeData: Record<string, unknown> = {
        title: [title],
        field_date: [state.field_date],
        field_rate: [state.field_rate],
        field_pay_installment: [state.field_pay_installment],
        field_pay_single_fee: [state.field_pay_single_fee],
        field_new_recurring_amount: [state.field_new_recurring_amount],
        field_is_simulated_payment: [
          state.field_intent === 'rate_change'
            ? 0
            : state.field_is_simulated_payment
              ? 1
              : 0,
        ],
        field_is_early_payment: [state.field_intent === 'extra' ? 1 : 0],
        field_loan_reference: [id],
      };

      // Always include field_new_principal and field_payment_method - send empty [] to clear on edit
      nodeData.field_new_principal =
        state.field_new_principal !== '' ? [state.field_new_principal] : [];
      nodeData.field_payment_method =
        state.field_payment_method !== '' ? [state.field_payment_method] : [];

      return nodeData;
    },
    successMessageKeys: {
      add: 'notification.paymentAdded',
      edit: 'notification.paymentUpdated',
    },
  });

  // Expose form submit handler and state to parent if needed
  React.useEffect(() => {
    if (onFormReady) {
      onFormReady(() => {
        const form = document.querySelector(
          `.payment-form-${formType}`
        ) as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }, isSubmitting);
    }
  }, [onFormReady, isSubmitting, formType]);

  const intent: PaymentIntent =
    (formState.field_intent as PaymentIntent) || 'regular';
  const isVisible = (name: string) => INTENT_FIELDS[intent].includes(name);

  const intentOptions: { value: PaymentIntent; label: string }[] = [
    { value: 'regular', label: t('paymentForm.intentPayment') },
    { value: 'rate_change', label: t('paymentForm.intentRate') },
  ];

  // Switching intent clears fields that do not belong to the new one, so a
  // regular payment cannot carry a rate change left over from an earlier choice.
  const selectIntent = (next: PaymentIntent) => {
    const nextState: Record<string, unknown> = {
      ...formState,
      field_intent: next,
    };
    for (const name of ALL_INTENT_FIELDS) {
      if (!INTENT_FIELDS[next].includes(name)) nextState[name] = '';
    }
    // Rate / terms changes are schedule events, not payments — never simulated.
    if (next === 'rate_change') {
      nextState.field_is_simulated_payment = false;
    }
    if (next === 'extra' && !formState.title) {
      nextState.title = t('paymentForm.extraTitle');
    }
    setFormState(nextState as typeof formState);
  };

  // "Extra / early" only marks a payment as early. The engine reads that from
  // the title, so the keyword is added here and removed again when unticked.
  const toggleExtra = (checked: boolean) => {
    const extraTitle = t('paymentForm.extraTitle');
    let title = formState.title;
    if (checked && !title) title = extraTitle;
    // Only drop the keyword we added; a title the user typed is left alone.
    if (!checked && title === extraTitle) title = '';
    setFormState({
      ...formState,
      field_intent: checked ? 'extra' : 'regular',
      title,
    });
  };

  return (
    <div className="payment-form-container">
      <form
        id={`payment-form-${formType}`}
        className={`payment-form payment-form-${formType}`}
        onSubmit={handleSubmit}
      >
        <div
          role="group"
          aria-label={t('paymentForm.intentLabel')}
          className="mb-4 grid grid-cols-2 gap-2"
        >
          {intentOptions.map((option) => {
            // "Payment" covers both a regular and an extra/early payment.
            const active =
              option.value === 'rate_change'
                ? intent === 'rate_change'
                : intent !== 'rate_change';
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (!active) selectIntent(option.value);
                }}
                className={`min-h-11 rounded-xl border px-2 py-2 text-center text-sm font-semibold leading-tight transition-colors ${
                  active
                    ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/15 text-app-primary'
                    : 'border-white/10 bg-white/5 text-app-secondary hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <FormField
          name="title"
          type="text"
          label={t('paymentForm.paymentTitle')}
          value={formState.title}
          onChange={handleChange}
          required
          placeholder={t('paymentForm.enterPaymentTitle')}
          isValid={getFieldValidation('title', formState)}
          ariaLabel={t('paymentForm.paymentTitle')}
        />

        <FormField
          name="field_date"
          type="date"
          label={t('paymentForm.paymentDate')}
          value={formState.field_date}
          onChange={handleChange}
          required
          isValid={getFieldValidation('field_date', formState)}
          ariaLabel={t('paymentForm.paymentDate')}
        />

        {isVisible('field_rate') && (
          <FormField
            name="field_rate"
            type="number"
            label={t('paymentForm.newInterestRate')}
            value={formState.field_rate}
            onChange={handleChange}
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_rate', formState)}
            ariaLabel={t('paymentForm.newInterestRate')}
          />
        )}

        {isVisible('field_pay_installment') && (
          <FormField
            name="field_pay_installment"
            type="number"
            label={t('paymentForm.installmentPayment')}
            value={formState.field_pay_installment}
            onChange={handleChange}
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_pay_installment', formState)}
            ariaLabel={t('paymentForm.installmentPayment')}
          />
        )}

        {isVisible('field_pay_single_fee') && (
          <FormField
            name="field_pay_single_fee"
            type="number"
            label={t('paymentForm.individualFee')}
            value={formState.field_pay_single_fee}
            onChange={handleChange}
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_pay_single_fee', formState)}
            ariaLabel={t('paymentForm.individualFee')}
          />
        )}

        {isVisible('field_new_recurring_amount') && (
          <FormField
            name="field_new_recurring_amount"
            type="number"
            label={t('paymentForm.newRecurringAmount')}
            value={formState.field_new_recurring_amount}
            onChange={handleChange}
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_new_recurring_amount', formState)}
            ariaLabel={t('paymentForm.newRecurringAmount')}
          />
        )}

        {isVisible('field_new_principal') && (
          <FormField
            name="field_new_principal"
            type="number"
            label={t('paymentForm.newPrincipalBalance')}
            value={formState.field_new_principal}
            onChange={handleChange}
            step="0.01"
            min="0"
            isValid={getFieldValidation('field_new_principal', formState)}
            ariaLabel={t('paymentForm.newPrincipalBalance')}
          />
        )}

        {isVisible('field_payment_method') && (
          <div className="form-group">
            <label>{t('paymentForm.newPaymentMethod')}</label>
            <div className="input-wrapper">
              <select
                name="field_payment_method"
                value={formState.field_payment_method}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">{t('paymentForm.keepCurrentMethod')}</option>
                <option value="equal_installment">
                  {t('loanForm.methodEqualInstallment')}
                </option>
                <option value="equal_principal">
                  {t('loanForm.methodEqualPrincipal')}
                </option>
              </select>
            </div>
          </div>
        )}

        {intent !== 'rate_change' && (
          <div className="flex flex-col gap-2 py-2">
            <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <span className="min-w-0 text-sm text-white/90">
                {t('paymentForm.intentExtra')}
              </span>
              <Switch
                checked={intent === 'extra'}
                onCheckedChange={toggleExtra}
              />
            </label>
            <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <span className="min-w-0 text-sm text-white/90">
                {t('paymentForm.simulatedPayment')}
              </span>
              <Switch
                checked={Boolean(formState.field_is_simulated_payment)}
                onCheckedChange={(checked) =>
                  setFormState({
                    ...formState,
                    field_is_simulated_payment: checked,
                  })
                }
              />
            </label>
          </div>
        )}

        {!hideSubmitButton && (
          <div className="sticky bottom-0 left-0 right-0 z-10 bg-[var(--color-app-bg)] pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={BTN_SUBMIT_CLASS}
            >
              {isSubmitting ? (
                <Loader variant="on-button" />
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

export default PaymentForm;
