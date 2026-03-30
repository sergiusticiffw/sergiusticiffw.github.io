export type LoanStatus = 'completed' | 'active' | 'pending'

export function getLoanStatus(status?: string): LoanStatus {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'active'
  return 'pending'
}

