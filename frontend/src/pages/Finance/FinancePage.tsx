import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  CircleDollarSign,
  Filter,
  Landmark,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useSession } from '../../contexts/SessionContext'
import {
  getFinanceCategories,
  getFinanceEntries,
  getFinanceSummary,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceEntryFilters,
  type FinanceSummary,
} from '../../services/finance.service'
import { getErrorMessage } from '../../utils/errors'

type EntryTypeFilter = '' | 'income' | 'expense'
type StatusFilter = '' | 'pending' | 'paid' | 'cancelled'

function money(value: string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function date(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
}

const statusLabels = {
  pending: 'Pendente',
  paid: 'Realizado',
  cancelled: 'Cancelado',
} as const

export function FinancePage() {
  const { can } = useSession()
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [entryType, setEntryType] = useState<EntryTypeFilter>('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [categoryId, setCategoryId] = useState('')

  const loadFinance = useCallback(async () => {
    setLoading(true)
    setError('')

    const filters: FinanceEntryFilters = {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      entry_type: entryType || undefined,
      status: status || undefined,
      category_id: categoryId || undefined,
    }

    try {
      const [currentSummary, currentEntries, currentCategories] = await Promise.all([
        getFinanceSummary({
          start_date: filters.start_date,
          end_date: filters.end_date,
          entry_type: filters.entry_type,
          category_id: filters.category_id,
        }),
        getFinanceEntries(filters),
        getFinanceCategories(),
      ])

      setSummary(currentSummary)
      setEntries(currentEntries)
      setCategories(currentCategories)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível carregar o Financeiro.'))
    } finally {
      setLoading(false)
    }
  }, [categoryId, endDate, entryType, startDate, status])

  useEffect(() => {
    void loadFinance()
  }, [loadFinance, requestVersion])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  function clearFilters() {
    setStartDate('')
    setEndDate('')
    setEntryType('')
    setStatus('')
    setCategoryId('')
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Controle financeiro</p>
          <h1>Financeiro</h1>
          <p>Acompanhe entradas, saídas e o saldo realizado da sua empresa.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            className="secondary-button gap-2"
            type="button"
            onClick={() => setRequestVersion((current) => current + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} aria-hidden="true" />
            Atualizar
          </button>
          {can('finance:manage') && (
            <>
              <Link className="secondary-button gap-2" to="/financeiro/categorias/nova">
                <Plus size={17} aria-hidden="true" />
                Nova categoria
              </Link>
              <Link className="primary-button gap-2" to="/financeiro/lancamentos/novo">
                <Plus size={17} aria-hidden="true" />
                Novo lançamento
              </Link>
            </>
          )}
        </div>
      </header>

      {loading && !summary ? (
        <LoadingState message="Carregando o Financeiro..." />
      ) : error && !summary ? (
        <ErrorState message={error} onRetry={() => setRequestVersion((current) => current + 1)} />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Resumo financeiro">
            <article className="page-card">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#effaf6] text-[#268267]">
                <ArrowUpFromLine size={20} aria-hidden="true" />
              </div>
              <span className="text-sm text-muted">Entradas realizadas</span>
              <strong className="mt-2 block font-display text-3xl font-semibold">
                {money(summary?.total_income || '0')}
              </strong>
              <small className="mt-2 block text-xs leading-5 text-[#8991aa]">
                Lançamentos com situação realizado
              </small>
            </article>

            <article className="page-card">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff3f5] text-[#b33d50]">
                <ArrowDownToLine size={20} aria-hidden="true" />
              </div>
              <span className="text-sm text-muted">Saídas realizadas</span>
              <strong className="mt-2 block font-display text-3xl font-semibold">
                {money(summary?.total_expense || '0')}
              </strong>
              <small className="mt-2 block text-xs leading-5 text-[#8991aa]">
                Despesas já pagas pela empresa
              </small>
            </article>

            <article className="page-card">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-signal">
                <CircleDollarSign size={20} aria-hidden="true" />
              </div>
              <span className="text-sm text-muted">Saldo realizado</span>
              <strong className="mt-2 block font-display text-3xl font-semibold">
                {money(summary?.balance || '0')}
              </strong>
              <small className="mt-2 block text-xs leading-5 text-[#8991aa]">
                Entradas menos saídas realizadas
              </small>
            </article>
          </section>

          <section className="page-card mt-6 min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Movimentações</p>
                <h2 className="mt-2 font-display text-xl font-semibold">Lançamentos financeiros</h2>
                <p className="mt-2 text-sm text-muted">
                  Consulte lançamentos realizados, pendentes e cancelados.
                </p>
              </div>
              <span className="rounded-full bg-[#f2f5ff] px-3 py-1 text-xs font-semibold text-signal">
                {entries.length} {entries.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">Data inicial</span>
                <span className="relative block">
                  <CalendarDays
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={16}
                  />
                  <input
                    className="form-input pl-10"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">Data final</span>
                <span className="relative block">
                  <CalendarDays
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={16}
                  />
                  <input
                    className="form-input pl-10"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">Tipo</span>
                <select
                  className="form-input"
                  value={entryType}
                  onChange={(event) => setEntryType(event.target.value as EntryTypeFilter)}
                >
                  <option value="">Todos os tipos</option>
                  <option value="income">Entradas</option>
                  <option value="expense">Saídas</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">Situação</span>
                <select
                  className="form-input"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                >
                  <option value="">Todas as situações</option>
                  <option value="paid">Realizados</option>
                  <option value="pending">Pendentes</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted">Categoria</span>
                <select
                  className="form-input"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {can('finance:manage') && categories.length > 0 && (
              <div className="mb-6 rounded-xl border border-line bg-[#fafbfe] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Configuração</p>
                    <h3 className="mt-1 font-display text-lg font-semibold">
                      Categorias financeiras
                    </h3>
                  </div>
                  <Link className="text-sm font-bold text-signal" to="/financeiro/categorias/nova">
                    Nova categoria
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Link
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-signal"
                      key={category.id}
                      to={`/financeiro/categorias/${category.id}/editar`}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {(startDate || endDate || entryType || status || categoryId) && (
              <button
                className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal"
                type="button"
                onClick={clearFilters}
              >
                <Filter size={16} aria-hidden="true" />
                Limpar filtros
              </button>
            )}

            {error && (
              <p className="mb-5 error-banner" role="alert">
                {error}
              </p>
            )}

            {loading ? (
              <LoadingState message="Atualizando lançamentos..." />
            ) : entries.length === 0 ? (
              <EmptyState
                title="Nenhum lançamento encontrado"
                description="Altere os filtros ou cadastre um lançamento para acompanhar o movimento financeiro."
              />
            ) : (
              <div className="overflow-x-auto">
                <div className="data-table min-w-[760px]">
                  <div className="data-table-row data-table-head">
                    <span>Lançamento</span>
                    <span>Categoria</span>
                    <span>Data</span>
                    <span>Situação</span>
                    <span className="text-right">Valor</span>
                    {can('finance:manage') && <span>Ações</span>}
                  </div>
                  {entries.map((entry) => (
                    <div className="data-table-row" key={entry.id}>
                      <span className="flex items-center gap-3">
                        <Landmark className="shrink-0 text-muted" size={18} aria-hidden="true" />
                        <span>
                          <strong>{entry.description}</strong>
                          <small>{entry.entry_type === 'income' ? 'Entrada' : 'Saída'}</small>
                        </span>
                      </span>
                      <span>
                        {categoryNames.get(entry.category_id) || 'Categoria não encontrada'}
                      </span>
                      <span>{date(entry.transaction_date)}</span>
                      <span>
                        <span
                          className={`fiscal-status-badge ${entry.status === 'paid' ? 'fiscal-status-success' : entry.status === 'cancelled' ? 'fiscal-status-neutral' : 'fiscal-status-warning'}`}
                        >
                          {statusLabels[entry.status]}
                        </span>
                      </span>
                      <strong
                        className={`text-right ${entry.entry_type === 'income' ? 'text-[#268267]' : 'text-[#b33d50]'}`}
                      >
                        {entry.entry_type === 'income' ? '+' : '-'} {money(entry.amount)}
                      </strong>
                      {can('finance:manage') && (
                        <Link
                          className="text-sm font-bold text-signal"
                          to={`/financeiro/lancamentos/${entry.id}/editar`}
                        >
                          Editar
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
