import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSaveAction } from '../../components/forms/useFormState'
import { apiFetch, apiFetchItems } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import type { FiscalDocument, FiscalOrder, FiscalProduct, FiscalSupplier } from './fiscalTypes'
import {
  UNSAVED_FORM_MESSAGE,
  createEmptyFiscalForm,
  createEmptyFiscalItem,
  fiscalDocumentFormErrors,
  isActiveFiscalStatus,
  isFiscalFormDirty,
  onlyDigits,
  taxIdError,
} from './fiscalUtils'

type FiscalAction = 'document' | 'supplier' | 'link' | 'event' | 'refresh' | 'receive'

export function useFiscalDocuments(orderFilter: string) {
  const [documents, setDocuments] = useState<FiscalDocument[]>([])
  const [orders, setOrders] = useState<FiscalOrder[]>([])
  const [products, setProducts] = useState<FiscalProduct[]>([])
  const [suppliers, setSuppliers] = useState<FiscalSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const { busy, pendingAction, isBusy, run: runAction } = useSaveAction<FiscalAction>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [type, setType] = useState<'saida' | 'entrada'>('saida')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(createEmptyFiscalForm)
  const [draftItems, setDraftItems] = useState([createEmptyFiscalItem()])
  // Estado do formulário no momento em que foi aberto, usado para detectar dados não salvos.
  const [formBaseline, setFormBaseline] = useState(createEmptyFiscalForm)
  const [itemsBaseline, setItemsBaseline] = useState([createEmptyFiscalItem()])
  const [formOpenedAt, setFormOpenedAt] = useState(0)
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
      apiFetchItems<FiscalOrder>('/api/orders'),
      apiFetchItems<FiscalProduct>('/api/products'),
      apiFetchItems<FiscalSupplier>('/api/fiscal-suppliers'),
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

  const matchesCommonFilters = useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')

    return (document: FiscalDocument) =>
      (!statusFilter || document.status === statusFilter) &&
      (!orderFilter || document.order_id === orderFilter) &&
      (!dateFrom || document.issue_date >= dateFrom) &&
      (!dateTo || document.issue_date <= dateTo) &&
      (!term ||
        `${document.number} ${document.participant_name} ${document.access_key || ''}`
          .toLowerCase()
          .includes(term) ||
        (digits.length >= 3 &&
          (document.participant_document || '').replace(/\D/g, '').includes(digits)))
  }, [statusFilter, orderFilter, dateFrom, dateTo, search])

  const visible = useMemo(
    () =>
      documents.filter(
        (document) => document.document_type === type && matchesCommonFilters(document),
      ),
    [documents, type, matchesCommonFilters],
  )

  const typeCounts = useMemo(
    () => ({
      saida: documents.filter(
        (document) => document.document_type === 'saida' && matchesCommonFilters(document),
      ).length,
      entrada: documents.filter(
        (document) => document.document_type === 'entrada' && matchesCommonFilters(document),
      ).length,
    }),
    [documents, matchesCommonFilters],
  )

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

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

  function clearFeedback() {
    if (isBusy()) return
    setError('')
    setNotice('')
  }

  async function run(kind: FiscalAction, action: () => Promise<void>) {
    await runAction(async () => {
      setError('')
      setNotice('')
      try {
        await action()
      } catch (requestError) {
        setError(getErrorMessage(requestError, 'Não foi possível concluir a operação.'))
      }
    }, kind)
  }

  const formDirty =
    showForm && isFiscalFormDirty(form, formBaseline, draftItems, itemsBaseline, supplierForm)

  // Avisa o navegador ao sair/recarregar a página com o formulário preenchido.
  useEffect(() => {
    if (!formDirty) {
      return
    }

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = UNSAVED_FORM_MESSAGE
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [formDirty])

  // Retorna true quando o formulário pode ser descartado (sem alterações ou confirmado).
  function confirmDiscard(): boolean {
    return !formDirty || window.confirm(UNSAVED_FORM_MESSAGE)
  }

  function closeForm(): boolean {
    if (pendingAction === 'document' || pendingAction === 'supplier' || !confirmDiscard()) {
      return false
    }

    setShowForm(false)
    setSupplierForm({ name: '', document: '' })
    return true
  }

  // Rola e foca o formulário que já está aberto, sem descartar o que foi digitado.
  function focusForm() {
    setFormOpenedAt(Date.now())
  }

  function start(orderId = orderFilter) {
    if (isBusy()) return
    if (showForm && !confirmDiscard()) {
      setFormOpenedAt(Date.now())
      return
    }

    const initial = {
      ...createEmptyFiscalForm(),
      order_id: orderId,
    }
    const initialItems = [createEmptyFiscalItem()]

    setForm(initial)
    setFormBaseline(initial)
    setDraftItems(initialItems)
    setItemsBaseline(initialItems)
    setSupplierForm({ name: '', document: '' })
    setShowForm(true)
    setFormOpenedAt(Date.now())
    void reloadFormOptions()
  }

  // Pedidos, produtos e fornecedores podem ter sido cadastrados depois que a
  // página abriu; recarrega as opções sempre que o formulário é aberto.
  async function reloadFormOptions() {
    await run('refresh', async () => {
      try {
        const [orderList, productList, supplierList] = await Promise.all([
          apiFetchItems<FiscalOrder>('/api/orders'),
          apiFetchItems<FiscalProduct>('/api/products'),
          apiFetchItems<FiscalSupplier>('/api/fiscal-suppliers'),
        ])

        setOrders(orderList)
        setProducts(productList)
        setSuppliers(supplierList)
      } catch (requestError) {
        setError(getErrorMessage(requestError, 'Falha ao carregar pedidos e fornecedores.'))
      }
    })
  }

  async function create(event: FormEvent) {
    event.preventDefault()

    await run('document', async () => {
      const formErrors = Object.values(fiscalDocumentFormErrors(form, draftItems))
      if (formErrors.length > 0) {
        setError(formErrors[0] || 'Revise os campos obrigatórios.')
        return
      }

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

    await run('supplier', async () => {
      const documentError = taxIdError(supplierForm.document)
      if (documentError) {
        setError(documentError)
        return
      }

      const supplier = await apiFetch<FiscalSupplier>('/api/fiscal-suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          document: onlyDigits(supplierForm.document),
        }),
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

    await run('link', async () => {
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

    await run('event', async () => {
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
    await run('refresh', async () => {
      setDocuments(await apiFetch<FiscalDocument[]>('/api/fiscal-documents'))

      setOrders(await apiFetchItems<FiscalOrder>('/api/orders'))

      setNotice('Lista atualizada.')
    })
  }

  async function receiveStock() {
    if (!selected) {
      return
    }

    await run('receive', async () => {
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
    pendingAction,
    clearFeedback,
    error,
    notice,
    type,
    setType,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearFilters,
    typeCounts,
    showForm,
    setShowForm,
    formDirty,
    formOpenedAt,
    closeForm,
    focusForm,
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
