import { apiFetch, apiFetchItems } from './api'

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
  due_date: string
  is_overdue: boolean
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  version: number
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
  sort?: 'transaction_date' | 'due_date'
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
  return apiFetchItems<FinanceEntry>(`/api/finance/entries${buildQuery(filters)}`)
}

export type FinanceEntryPayload = {
  category_id: string
  description: string
  amount: string
  entry_type: 'income' | 'expense'
  status: 'pending' | 'paid' | 'cancelled'
  transaction_date: string
  due_date?: string
  paid_at?: string | null
  notes?: string | null
}

export type FinanceEntryUpdatePayload = Partial<FinanceEntryPayload> & {
  expected_version: number
}

export type FinanceEventType =
  'entry_created' | 'entry_updated' | 'entry_settled' | 'attachment_added' | 'attachment_removed'

export const financeEventLabels: Record<FinanceEventType, string> = {
  entry_created: 'Cadastro',
  entry_updated: 'Alteração',
  entry_settled: 'Baixa',
  attachment_added: 'Anexo incluído',
  attachment_removed: 'Anexo removido',
}

export type FinanceAuditSearchEvent = {
  id: string
  entry_id: string
  entry_description: string
  event_type: FinanceEventType
  actor_name: string
  created_at: string
  version: number
  changes: Record<string, { before: string | null; after: string | null }>
}

export type FinanceAuditSearchPage = {
  items: FinanceAuditSearchEvent[]
  total: number
  page: number
  page_size: number
  has_next: boolean
}

export type FinanceAuditFilters = {
  query?: string
  actor?: string
  start_date?: string
  end_date?: string
  before_value?: string
  after_value?: string
  page?: number
  page_size?: number
}

export function getFinanceAudit(filters: FinanceAuditFilters = {}) {
  return apiFetch<FinanceAuditSearchPage>(
    `/api/finance/audit${buildQuery(filters as FinanceEntryFilters & FinanceAuditFilters)}`,
  )
}

export type FinanceEntryHistory = {
  id: string
  event_type: FinanceEventType
  actor_name: string
  created_at: string
  version: number
  changes: Record<string, { before: string | null; after: string | null }>
}

export function getFinanceEntry(entryId: string) {
  return apiFetch<FinanceEntry>(`/api/finance/entries/${entryId}`)
}

export function getFinanceEntryHistory(entryId: string) {
  return apiFetch<FinanceEntryHistory[]>(`/api/finance/entries/${entryId}/history`)
}

export function createFinanceEntry(payload: FinanceEntryPayload) {
  return apiFetch<FinanceEntry>('/api/finance/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinanceEntry(entryId: string, payload: FinanceEntryUpdatePayload) {
  return apiFetch<FinanceEntry>(`/api/finance/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function settleFinanceEntry(
  entryId: string,
  payload: { expected_version: number; paid_at?: string | null },
) {
  return apiFetch<FinanceEntry>(`/api/finance/entries/${entryId}/settle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type FinanceAttachment = {
  id: string
  entry_id: string
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_by: string
  created_at: string
}

export const ATTACHMENT_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp,.xml,text/xml'
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

export function getFinanceAttachments(entryId: string) {
  return apiFetch<FinanceAttachment[]>(`/api/finance/entries/${entryId}/attachments`)
}

export function uploadFinanceAttachment(entryId: string, file: File) {
  const isXml = file.name.toLowerCase().endsWith('.xml')
  const contentType = file.type || (isXml ? 'application/xml' : 'application/octet-stream')
  const fileName = encodeURIComponent(file.name)
  const path = `/api/finance/entries/${entryId}/attachments?file_name=${fileName}`
  return apiFetch<FinanceAttachment>(path, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: file,
  })
}

export function downloadFinanceAttachment(entryId: string, attachmentId: string) {
  const path = `/api/finance/entries/${entryId}/attachments/${attachmentId}/download`
  return apiFetch<Blob>(path, {}, 'blob')
}

export function deleteFinanceAttachment(entryId: string, attachmentId: string) {
  return apiFetch<null>(`/api/finance/entries/${entryId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}
