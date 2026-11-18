import { apiFetch } from './api'
import type { PaginatedResponse } from './api'

export type Supplier = {
  id: string
  name: string
  document: string
  phone: string | null
  email: string | null
  is_active: boolean
}

export type SupplierPayload = {
  name: string
  document: string
  phone: string | null
  email: string | null
}

export type SupplierUpdatePayload = Partial<SupplierPayload> & { is_active?: boolean }

const SUPPLIERS_URL = '/api/fiscal-suppliers'
// Limite aceito pela API em cada página.
const PAGE_SIZE = 100
// Trava de segurança: nunca percorre mais do que 10.000 fornecedores de uma vez.
const MAX_PAGES = 100

// A listagem é paginada. Percorre todas as páginas para que nenhum fornecedor
// fique de fora das telas e dos campos de seleção.
export async function listAllSuppliers(): Promise<Supplier[]> {
  const suppliers: Supplier[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await apiFetch<PaginatedResponse<Supplier>>(
      `${SUPPLIERS_URL}?page=${page}&page_size=${PAGE_SIZE}&sort=name`,
    )

    suppliers.push(...response.items)

    if (!response.has_next) {
      break
    }
  }

  return suppliers
}

export function getSupplier(supplierId: string): Promise<Supplier> {
  return apiFetch<Supplier>(`${SUPPLIERS_URL}/${supplierId}`)
}

export function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  return apiFetch<Supplier>(SUPPLIERS_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSupplier(
  supplierId: string,
  payload: SupplierUpdatePayload,
): Promise<Supplier> {
  return apiFetch<Supplier>(`${SUPPLIERS_URL}/${supplierId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
