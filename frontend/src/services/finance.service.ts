import { apiFetch } from './api'

export type FinanceCategory = {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

export type FinanceEntry = {
  id: string
  category_id: string
  description: string
  amount: string
  entry_type: 'income' | 'expense'
  status: 'pending' | 'paid' | 'cancelled'
  transaction_date: string
  paid_at: string | null
  notes: string | null
}

export type FinanceSummary = {
  total_income: string
  total_expense: string
  balance: string
}

export function getFinanceSummary(filters: Omit<FinanceEntryFilters, 'status'> = {}) {
  return apiFetch<FinanceSummary>(`/api/finance/summary${buildQuery(filters)}`)
}

export function getFinanceCategories() {
  return apiFetch<FinanceCategory[]>('/api/finance/categories')
}

export type FinanceCategoryPayload = {
  name: string
  description?: string | null
}

export function getFinanceCategory(categoryId: string) {
  return apiFetch<FinanceCategory>(`/api/finance/categories/${categoryId}`)
}

export function createFinanceCategory(payload: FinanceCategoryPayload) {
  return apiFetch<FinanceCategory>('/api/finance/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceCategory(
  categoryId: string,
  payload: FinanceCategoryPayload & { is_active?: boolean },
) {
  return apiFetch<FinanceCategory>(`/api/finance/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type FinanceEntryFilters = {
  start_date?: string
  end_date?: string
  entry_type?: 'income' | 'expense'
  status?: 'pending' | 'paid' | 'cancelled'
  category_id?: string
}

function buildQuery(filters: FinanceEntryFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function getFinanceEntries(filters: FinanceEntryFilters = {}) {
  return apiFetch<FinanceEntry[]>(`/api/finance/entries${buildQuery(filters)}`)
}

export type FinanceEntryPayload = {
  category_id: string
  description: string
  amount: string
  entry_type: 'income' | 'expense'
  status: 'pending' | 'paid' | 'cancelled'
  transaction_date: string
  paid_at?: string | null
  notes?: string | null
}

export function getFinanceEntry(entryId: string) {
  return apiFetch<FinanceEntry>(`/api/finance/entries/${entryId}`)
}

export function createFinanceEntry(payload: FinanceEntryPayload) {
  return apiFetch<FinanceEntry>('/api/finance/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceEntry(entryId: string, payload: Partial<FinanceEntryPayload>) {
  return apiFetch<FinanceEntry>(`/api/finance/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
