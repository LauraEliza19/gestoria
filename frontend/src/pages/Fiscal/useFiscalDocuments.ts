import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import type { FiscalDocument, FiscalOrder, FiscalProduct, FiscalSupplier } from './fiscalTypes'
import { createEmptyFiscalForm, createEmptyFiscalItem, isActiveFiscalStatus } from './fiscalUtils'

export function useFiscalDocuments(orderFilter: string) {
  const [documents, setDocuments] = useState<FiscalDocument[]>([])
  const [orders, setOrders] = useState<FiscalOrder[]>([])
  const [products, setProducts] = useState<FiscalProduct[]>([])
  const [suppliers, setSuppliers] = useState<FiscalSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [type, setType] = useState<'saida' | 'entrada'>('saida')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createEmptyFiscalForm)
  const [draftItems, setDraftItems] = useState([createEmptyFiscalItem()])
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    document: '',
  })
  const [selected, setSelected] = useState<FiscalDocument | null>(null)
  const [eventForm, setEventForm] = useState({
    status: '',
    occurred_at: '',
    protocol: '',
    reason: '',
  })
  const [linkForm, setLinkForm] = useState({
    order_id: '',
    reason: '',
  })

  useEffect(() => {
    let cancelled = false

    Promise.all([
      apiFetch<FiscalDocument[]>('/api/fiscal-documents'),
      apiFetch<FiscalOrder[]>('/api/orders'),
      apiFetch<FiscalProduct[]>('/api/products'),
      apiFetch<FiscalSupplier[]>('/api/fiscal-suppliers'),
    ])
      .then(([docs, orderList, productList, supplierList]) => {
        if (cancelled) {
          return
        }

        setDocuments(docs)
        setOrders(orderList)
        setProducts(productList)
        setSuppliers(supplierList)
        setLoading(false)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(requestError, 'Falha ao carregar os dados.'))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.document_type === type &&
          (!statusFilter || document.status === statusFilter) &&
          (!orderFilter || document.order_id === orderFilter) &&
          `${document.number} ${document.participant_name} ${document.access_key || ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [documents, type, statusFilter, orderFilter, search],
  )

  const contextOrder = orders.find((order) => order.id === orderFilter)

  const isOccupied = (id: string) =>
    documents.some(
      (document) =>
        document.document_type === 'saida' &&
        document.order_id === id &&
        isActiveFiscalStatus(document.status),
    )

  function selectDocument(document: FiscalDocument) {
    setSelected(document)
    setEventForm({
      status: '',
      occurred_at: '',
      protocol: '',
      reason: '',
    })
    setLinkForm({
      order_id: document.order_id || '',
      reason: '',
    })
  }

  function remember(document: FiscalDocument) {
    setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)])
    selectDocument(document)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await action()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível concluir a operação.'))
    } finally {
      setBusy(false)
    }
  }

  function start(orderId = orderFilter) {
    setForm({
      ...createEmptyFiscalForm(),
      order_id: orderId,
    })
    setDraftItems([createEmptyFiscalItem()])
    setShowForm(true)
  }

  async function create(event: FormEvent) {
    event.preventDefault()

    await run(async () => {
      const { order_id, supplier_id, ...metadata } = form

      const payload = {
        ...metadata,
        cfop: form.cfop || null,
        operation_nature: form.operation_nature || null,
        access_key: form.access_key || null,
        ...(form.document_type === 'saida'
          ? { order_id }
          : {
              supplier_id,
              items: draftItems,
            }),
      }

      const saved = await apiFetch<FiscalDocument>('/api/fiscal-documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      remember(saved)
      setType(saved.document_type)
      setShowForm(false)
      setNotice(
        'Documento registrado. Nenhuma autorização externa ou movimentação adicional de estoque foi realizada.',
      )
    })
  }

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await run(async () => {
      const supplier = await apiFetch<FiscalSupplier>('/api/fiscal-suppliers', {
        method: 'POST',
        body: JSON.stringify(supplierForm),
      })

      setSuppliers((current) => [...current, supplier])

      setForm((current) => ({
        ...current,
        supplier_id: supplier.id,
      }))

      setSupplierForm({
        name: '',
        document: '',
      })

      setNotice('Fornecedor cadastrado.')
    })
  }

  async function reconcileOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selected) {
      return
    }

    await run(async () => {
      const document = await apiFetch<FiscalDocument>(
        `/api/fiscal-documents/${selected.id}/link-order`,
        {
          method: 'POST',
          body: JSON.stringify(linkForm),
        },
      )

      remember(document)
      setNotice('Vínculo conciliado e registrado no histórico.')
    })
  }

  async function statusEvent(event: FormEvent) {
    event.preventDefault()

    if (!selected) {
      return
    }

    await run(async () => {
      const payload = {
        status: eventForm.status,
        occurred_at: eventForm.occurred_at ? new Date(eventForm.occurred_at).toISOString() : null,
        protocol: eventForm.protocol || null,
        reason: eventForm.reason || null,
      }

      remember(
        await apiFetch<FiscalDocument>(`/api/fiscal-documents/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      )

      setNotice('Evento registrado no histórico fiscal.')
    })
  }

  async function refreshDocuments() {
    await run(async () => {
      setDocuments(await apiFetch<FiscalDocument[]>('/api/fiscal-documents'))

      setOrders(await apiFetch<FiscalOrder[]>('/api/orders'))

      setNotice('Lista atualizada.')
    })
  }

  async function receiveStock() {
    if (!selected) {
      return
    }

    await run(async () => {
      const document = await apiFetch<FiscalDocument>(
        `/api/fiscal-documents/${selected.id}/receive`,
        {
          method: 'POST',
        },
      )

      remember(document)
      setNotice('Estoque recebido e registrado.')
    })
  }

  return {
    documents,
    orders,
    products,
    suppliers,
    loading,
    busy,
    error,
    notice,
    type,
    setType,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    showForm,
    setShowForm,
    form,
    setForm,
    draftItems,
    setDraftItems,
    supplierForm,
    setSupplierForm,
    selected,
    setSelected,
    eventForm,
    setEventForm,
    linkForm,
    setLinkForm,
    visible,
    contextOrder,
    isOccupied,
    selectDocument,
    start,
    create,
    createSupplier,
    reconcileOrder,
    statusEvent,
    refreshDocuments,
    receiveStock,
  }
}
