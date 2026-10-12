export type FiscalDocumentType = 'saida' | 'entrada'

export type FiscalItem = {
  id?: string
  product_id: string
  product_name: string
  quantity: string
  unit_price: string
  unit_of_measure?: string
  total?: string
  fiscal_snapshot?: Record<string, string | null>
}

export type FiscalEvent = {
  id: string
  action: string
  actor_id: string
  created_at: string
  detail: Record<string, string | null>
}

export type FiscalDocument = {
  id: string
  document_type: FiscalDocumentType
  number: string
  series: string
  model: string
  participant_name: string
  participant_document: string | null
  issue_date: string
  cfop?: string | null
  operation_nature?: string | null
  value: string
  status: string
  xml_available?: boolean
  pdf_available?: boolean
  order_id: string | null
  customer_id?: string | null
  supplier_id: string | null
  created_by_id: string | null
  created_at: string
  updated_at?: string
  authorized_at: string | null
  cancelled_at: string | null
  authorization_protocol: string | null
  cancellation_protocol: string | null
  cancellation_reason: string | null
  access_key: string | null
  is_legacy: boolean
  snapshot_source: string
  reconciled_at: string | null
  stock_received_at: string | null
  items: FiscalItem[]
  allowed_statuses: string[]
  events: FiscalEvent[]
}

export type FiscalOrder = {
  id: string
  customer_name: string
  status: string
  total_amount: string
  items: FiscalItem[]
}

export type FiscalProduct = {
  id: string
  name: string
  is_active: boolean
}

export type FiscalSupplier = {
  id: string
  name: string
  document: string
  is_active: boolean
}

export type FiscalFormState = {
  document_type: FiscalDocumentType
  order_id: string
  supplier_id: string
  number: string
  series: string
  model: string
  issue_date: string
  cfop: string
  operation_nature: string
  access_key: string
}

export type FiscalDraftItem = {
  product_id: string
  quantity: string
  unit_price: string
}

export type SupplierFormState = {
  name: string
  document: string
}

export type FiscalEventFormState = {
  status: string
  occurred_at: string
  protocol: string
  reason: string
}

export type FiscalLinkFormState = {
  order_id: string
  reason: string
}

export type FiscalOrganization = Record<string, string | null>

export type FiscalParty = {
  name: string
  document: string | null
}

export type FiscalModalView = 'details' | 'danfe' | 'history' | 'lifecycle'

export type FiscalSortKey =
  | 'emitter'
  | 'recipient'
  | 'number'
  | 'value'
  | 'issue_date'
  | 'updated_at'

export type FiscalSort = {
  key: FiscalSortKey
  direction: 'asc' | 'desc'
}
