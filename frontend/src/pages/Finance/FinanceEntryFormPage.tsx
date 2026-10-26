import { ArrowLeft, CircleDollarSign, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  createFinanceEntry,
  getFinanceCategories,
  getFinanceEntry,
  getFinanceEntryHistory,
  updateFinanceEntry,
  type FinanceCategory,
  type FinanceEntryHistory,
} from '../../services/finance.service'
import { ApiError } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'

export function FinanceEntryFormPage() {
  const { entryId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(entryId)
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income')
  const [status, setStatus] = useState<'pending' | 'paid' | 'cancelled'>('pending')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null)
  const [conflict, setConflict] = useState<{
    version: number
    updatedAt: string
    current: Record<string, string | number | null>
    submitted: Record<string, string | null>
  } | null>(null)
  const [history, setHistory] = useState<FinanceEntryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getFinanceCategories(),
      entryId ? getFinanceEntry(entryId) : Promise.resolve(null),
      entryId ? getFinanceEntryHistory(entryId) : Promise.resolve([]),
    ])
      .then(([currentCategories, entry, currentHistory]) => {
        setCategories(currentCategories.filter((category) => category.is_active || category.id === entry?.category_id))
        if (entry) {
          setCategoryId(entry.category_id)
          setDescription(entry.description)
          setAmount(entry.amount)
          setEntryType(entry.entry_type)
          setStatus(entry.status)
          setTransactionDate(entry.transaction_date)
          setNotes(entry.notes || '')
          setExpectedVersion(entry.version)
        }
        setHistory(currentHistory)
        setLoading(false)
      })
      .catch((requestError) => {
        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar o lançamento.'))
      })
  }, [entryId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setConflict(null)
    const payload = {
      category_id: categoryId,
      description: description.trim(),
      amount: amount.replace(',', '.'),
      entry_type: entryType,
      status,
      transaction_date: transactionDate,
      notes: notes.trim() || null,
    }
    try {
      if (entryId) {
        if (expectedVersion === null) throw new Error('A versão do lançamento ainda não foi carregada.')
        await updateFinanceEntry(entryId, { ...payload, expected_version: expectedVersion })
      }
      else await createFinanceEntry(payload)
      navigate('/financeiro', { replace: true })
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.status === 409 &&
        typeof requestError.detail === 'object' &&
        requestError.detail !== null &&
        'current' in requestError.detail
      ) {
        const detail = requestError.detail as {
          current: Record<string, string | number | null>
        }
        const current = detail.current
        setConflict({
          version: Number(current.version),
          updatedAt: String(current.updated_at),
          current,
          submitted: payload,
        })
      }
      setError(getErrorMessage(requestError, 'Não foi possível salvar o lançamento.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="page-wrap"><LoadingState message="Carregando lançamento..." /></main>
  if (error && !categories.length) return <main className="page-wrap"><ErrorState message={error} /></main>

  const fieldLabels: Record<string, string> = {
    category_id: 'Categoria',
    description: 'Descrição',
    amount: 'Valor',
    entry_type: 'Tipo',
    status: 'Situação',
    transaction_date: 'Data',
    paid_at: 'Pagamento',
    notes: 'Observações',
  }
  const displayValue = (field: string, value: string | number | null) => {
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'category_id') return categories.find((category) => category.id === value)?.name || String(value)
    if (field === 'entry_type') return value === 'income' ? 'Entrada' : 'Saída'
    if (field === 'status') return ({ pending: 'Pendente', paid: 'Realizado', cancelled: 'Cancelado' } as Record<string, string>)[String(value)] || String(value)
    return String(value)
  }
  const conflictFields = conflict
    ? Object.keys(fieldLabels).filter((field) => String(conflict.current[field] ?? '') !== String(conflict.submitted[field] ?? ''))
    : []

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <Link className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal" to="/financeiro"><ArrowLeft size={16} aria-hidden="true" /> Voltar para o Financeiro</Link>
          <p className="eyebrow">Controle financeiro</p>
          <h1>{editing ? 'Editar lançamento' : 'Cadastrar lançamento'}</h1>
          <p>Registre uma entrada ou saída da empresa.</p>
        </div>
      </header>
      <form className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" onSubmit={handleSubmit}>
        <section className="page-card">
          <div className="mb-7 flex items-start gap-3 border-b border-line pb-5"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-signal"><CircleDollarSign size={21} aria-hidden="true" /></div><div><h2 className="font-display text-xl font-semibold">Dados do lançamento</h2><p className="mt-1 text-sm text-muted">O valor deve ser positivo; o tipo define entrada ou saída.</p></div></div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="form-label md:col-span-2">Descrição<input className="form-input" value={description} maxLength={200} required autoFocus onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="form-label">Valor<input className="form-input" inputMode="decimal" placeholder="0,00" value={amount} required onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="form-label">Categoria<select className="form-input" value={categoryId} required onChange={(event) => setCategoryId(event.target.value)}><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="form-label">Tipo<select className="form-input" value={entryType} onChange={(event) => setEntryType(event.target.value as 'income' | 'expense')}><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
            <label className="form-label">Situação<select className="form-input" value={status} onChange={(event) => setStatus(event.target.value as 'pending' | 'paid' | 'cancelled')}><option value="pending">Pendente</option><option value="paid">Realizado</option><option value="cancelled">Cancelado</option></select></label>
            <label className="form-label">Data<input className="form-input" type="date" value={transactionDate} required onChange={(event) => setTransactionDate(event.target.value)} /></label>
            <label className="form-label md:col-span-2">Observações<textarea className="form-input min-h-32 resize-y" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          {error && <p className="mt-6 text-sm text-[#d84f62]" role="alert">{error}</p>}
          {conflict && (
            <div className="mt-4 rounded-lg border border-[#e6a23c] bg-[#fff8e8] p-4 text-sm text-[#7a4b00]" role="alert">
              <strong>Conflito de edição: o lançamento não foi substituído.</strong>
              <p className="mt-1">
                Outra pessoa salvou a versão {conflict.version} em {new Date(conflict.updatedAt).toLocaleString('pt-BR')}.
                Compare abaixo a sua versão com a versão atual antes de tentar novamente.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr><th className="pb-2 pr-3">Campo</th><th className="pb-2 pr-3">Sua versão</th><th className="pb-2">Versão atual</th></tr></thead>
                  <tbody>{conflictFields.map((field) => <tr key={field} className="border-t border-[#f0d7a4]"><td className="py-2 pr-3 font-semibold">{fieldLabels[field]}</td><td className="py-2 pr-3">{displayValue(field, conflict.submitted[field])}</td><td className="py-2">{displayValue(field, conflict.current[field])}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end"><Link className="secondary-button" to="/financeiro">Cancelar</Link><button className="primary-button gap-2" type="submit" disabled={saving || !categories.length}><Save size={17} aria-hidden="true" />{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar lançamento'}</button></div>
        </section>
        <aside className="page-card h-fit">
          <p className="eyebrow">Histórico do lançamento</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Alterações registradas</h2>
          {history.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhuma alteração registrada.</p> : (
            <div className="mt-4 space-y-4">
              {history.map((event) => (
                <div className="border-l-2 border-signal pl-3 text-sm" key={event.id}>
                  <strong>Versão {event.version} · {event.event_type === 'entry_created' ? 'Cadastro' : 'Alteração'}</strong>
                  <p className="mt-1 text-xs text-muted">{event.actor_name} · {new Date(event.created_at).toLocaleString('pt-BR')}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {Object.entries(event.changes).map(([field, change]) => <li key={field}><strong>{fieldLabels[field] || field}:</strong> {displayValue(field, change.before)} → {displayValue(field, change.after)}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-6 border-t border-line pt-4 text-sm leading-6 text-muted">Somente lançamentos com situação <strong>Realizado</strong> entram no resumo financeiro.</p>
        </aside>
      </form>
    </main>
  )
}
