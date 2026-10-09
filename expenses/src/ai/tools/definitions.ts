import { GeminiFunctionDeclaration } from '../client';
import { loanToolDeclarations } from './loanTools';

const filterProperties = {
  kind: {
    type: 'string',
    enum: ['expense', 'income', 'all'],
    description: 'Default expense.',
  },
  from: { type: 'string', description: 'Start date YYYY-MM-DD or YYYY-MM, inclusive.' },
  to: { type: 'string', description: 'End date YYYY-MM-DD or YYYY-MM, inclusive.' },
  categories: {
    type: 'array',
    items: { type: 'string' },
    description: 'Category ids from CATEGORIES.',
  },
  text: {
    type: 'string',
    description: 'Case/diacritics-insensitive substring of the description, e.g. "kaufland" or "#lunch".',
  },
  minAmount: { type: 'number' },
  maxAmount: { type: 'number' },
};

export const toolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'aggregate',
    description:
      'Exact totals grouped by a dimension, with optional filters. Prefer this over query_transactions.',
    parameters: {
      type: 'object',
      properties: {
        groupBy: {
          type: 'string',
          enum: ['month', 'year', 'category', 'description', 'hashtag', 'weekday'],
        },
        ...filterProperties,
        sort: { type: 'string', enum: ['total_desc', 'count_desc', 'key_asc', 'key_desc'] },
        limit: { type: 'integer', description: 'Max groups, default 60.' },
      },
      required: ['groupBy'],
    },
  },
  {
    name: 'query_transactions',
    description: 'Individual records matching filters. Use only when single items are needed.',
    parameters: {
      type: 'object',
      properties: {
        ...filterProperties,
        sort: { type: 'string', enum: ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'] },
        limit: { type: 'integer', description: 'Max rows, default 50.' },
      },
    },
  },
  {
    name: 'get_month_summary',
    description:
      'Totals, income, savings, per-category spend vs previous 3/12 month averages, biggest expenses and, for the current month, a projection.',
    parameters: {
      type: 'object',
      properties: { month: { type: 'string', description: 'YYYY-MM' } },
      required: ['month'],
    },
  },
  {
    name: 'compare_periods',
    description: 'Per-category totals for two date ranges with absolute and % change.',
    parameters: {
      type: 'object',
      properties: {
        aFrom: { type: 'string' },
        aTo: { type: 'string' },
        bFrom: { type: 'string' },
        bTo: { type: 'string' },
        kind: { type: 'string', enum: ['expense', 'income'] },
      },
      required: ['aFrom', 'aTo', 'bFrom', 'bTo'],
    },
  },
  {
    name: 'list_loans',
    description:
      'Every loan plus its rate changes, payments, fees, principal changes and method changes. Same figures as the Loans page.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_loan_detail',
    description:
      'One loan: totals, current rate, interest saved by extra payments, the next unpaid schedule rows, and every rate change, payment or other event.',
    parameters: {
      type: 'object',
      properties: {
        loan: {
          type: 'string',
          description: 'Loan name from LOANS. Optional when the user has a single loan.',
        },
      },
    },
  },
  {
    name: 'query_loan_payments',
    description:
      'Loan events: payments, fees, rate changes, new principal, new recurring installment and method changes. Optional loan name and date range. Planned rows are marked.',
    parameters: {
      type: 'object',
      properties: {
        loan: { type: 'string', description: 'Loan name. Omit for all loans.' },
        from: { type: 'string', description: 'Start date YYYY-MM-DD or YYYY-MM, inclusive.' },
        to: { type: 'string', description: 'End date YYYY-MM-DD or YYYY-MM, inclusive.' },
        limit: { type: 'integer', description: 'Max rows, default 50.' },
      },
    },
  },
  ...loanToolDeclarations,
];
