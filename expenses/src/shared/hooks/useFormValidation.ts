type ValidationRule = {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, formState?: any) => boolean;
};

type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule;
};

interface UseFormValidationReturn {
  validateField: (name: string, value: any, formState?: any) => boolean;
  getFieldValidation: (name: string, formState: any) => boolean;
  isFormValid: (formState: any) => boolean;
}

export const useFormValidation = <T extends Record<string, any>>(
  rules: ValidationRules<T>
): UseFormValidationReturn => {
  const validateField = (
    name: string,
    value: any,
    formState?: any
  ): boolean => {
    const rule = rules[name as keyof T];
    if (!rule) return true;

    // Required check
    if (rule.required) {
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'string' && value.trim() === '') return false;
    }

    // If not required and empty, it's valid
    if (
      !rule.required &&
      (value === '' || value === null || value === undefined)
    ) {
      return true;
    }

    // Number validations
    if (rule.min !== undefined || rule.max !== undefined) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return false;
      if (rule.min !== undefined && numValue < rule.min) return false;
      if (rule.max !== undefined && numValue > rule.max) return false;
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) return false;
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value, formState);
    }

    return true;
  };

  const getFieldValidation = (name: string, formState: any): boolean => {
    const value = formState[name];
    return validateField(name, value, formState);
  };

  const isFormValid = (formState: any): boolean => {
    return Object.keys(rules).every((fieldName) => {
      const value = formState[fieldName];
      return validateField(fieldName, value, formState);
    });
  };

  return {
    validateField,
    getFieldValidation,
    isFormValid,
  };
};
