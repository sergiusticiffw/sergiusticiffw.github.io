export interface ApiLoan {
  id: string
  title?: string
  field_principal: number
  field_start_date: string
  field_end_date: string
  field_rate: number
  field_initial_fee?: number
  field_rec_first_payment_date?: string
  field_recurring_payment_day?: number
  field_payment_method: 'equal_installment' | 'equal_principal'
  field_loan_status: 'in_progress' | 'draft' | 'completed'
  [key: string]: unknown
}

export interface ApiPaymentItem {
  id?: string
  title?: string
  field_date: string
  field_rate?: number
  field_pay_installment?: number
  field_pay_single_fee?: number
  field_new_recurring_amount?: number
  field_new_principal?: number
  field_payment_method?: 'equal_installment' | 'equal_principal'
  field_is_simulated_payment: boolean
  field_loan_reference?: number | string | unknown
  [key: string]: unknown
}

export interface LoanPaymentsEntry {
  loanId: string
  data: ApiPaymentItem[]
}

