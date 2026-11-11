import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/AsyncState'
import { getFinanceAudit, type FinanceAuditSearchEvent } from '../../services/finance.service'
import { getErrorMessage } from '../../utils/errors'

const fieldLabels: Record<string, string> = {
  category_id: 'Categoria',
  description: 'Descrição',
  amount: 'Valor',
  entry_type: 'Tipo',
  status: 'Situação',
  transaction_date: 'Data do lançamento',
  paid_at: 'Data de pagamento',
  notes: 'Observações',
}

const AUDIT_PAGE_SIZE = 50

function displayValue(field: string, value: string | null) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'amount') {
    const amount = Number(value)
    return Number.isFinite(amount)
      ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : value
  }
  if (field === 'entry_type') return value === 'income' ? 'Entrada' : 'Saída'
  if (field === 'status')
    return (
      (
        { pending: 'Pendente', paid: 'Realizado', cancelled: 'Cancelado' } as Record<string, string>
      )[value] || value
    )
  return value
}

export function FinanceAuditPage() {
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [beforeValue, setBeforeValue] = useState('')
  const [afterValue, setAfterValue] = useState('')
  const [events, setEvents] = useState<FinanceAuditSearchEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(requestedPage = 1) {
    setLoading(true)
    setError('')

    try {
      const result = await getFinanceAudit({
        query: query.trim() || undefined,
        actor: actor.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        before_value: beforeValue.trim() || undefined,
        after_value: afterValue.trim() || undefined,
        page: requestedPage,
        page_size: AUDIT_PAGE_SIZE,
      })

      setEvents(result.items)
      setTotal(result.total)
      setPage(result.page)
      setHasNext(result.has_next)
    } catch (requestError) {
      const message = getErrorMessage(
        requestError,
        'Não foi possível carregar o histórico de auditoria.',
      )
      const isNetworkError = /failed to fetch|networkerror|load failed/i.test(message)
      setError(
        isNetworkError
          ? 'Não foi possível carregar o histórico de auditoria. Verifique sua conexão e tente novamente.'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void search(1)
    // Initial load only; filters are applied by the search action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Controle financeiro</p>
          <h1>Auditoria financeira</h1>
          <p>Consulte quem alterou os lançamentos e compare os valores registrados.</p>
        </div>
        <Link className="secondary-button gap-2" to="/financeiro">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao financeiro
        </Link>
      </header>

      <section className="page-card">
        <div className="mb-5 flex items-center gap-2">
          <Search size={18} aria-hidden="true" className="text-muted" />
          <h2 className="font-display text-xl font-semibold">Pesquisar histórico</h2>
        </div>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            void search(1)
          }}
        >
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Lançamento ou ID</span>
            <input
              className="form-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Descrição ou identificador"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Usuário responsável</span>
            <input
              className="form-input"
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              placeholder="Nome do usuário"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Data inicial da alteração
            </span>
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Data final da alteração
            </span>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">
              Valor anterior contém
            </span>
            <input
              className="form-input"
              value={beforeValue}
              onChange={(event) => setBeforeValue(event.target.value)}
              placeholder="Ex.: 120,00"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Valor novo contém</span>
            <input
              className="form-input"
              value={afterValue}
              onChange={(event) => setAfterValue(event.target.value)}
              placeholder="Ex.: 150,00"
            />
          </label>
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Consultando...' : 'Pesquisar auditoria'}
            </button>
          </div>
        </form>
      </section>

      <section className="page-card mt-5">
        <h2 className="font-display text-xl font-semibold">Linha do tempo</h2>
        {error && (
          <div className="error-banner mt-4 flex flex-wrap items-center justify-between gap-3" role="alert">
            <p>{error}</p>
            <button
              className="secondary-button"
              type="button"
              disabled={loading}
              onClick={() => {
                void search(1)
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <LoadingState message="Consultando histórico financeiro..." />
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nenhum evento encontrado para os filtros informados.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {events.map((event) => (
              <article className="border-l-2 border-signal pl-4" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{event.entry_description}</strong>
                  <span className="text-xs text-muted">
                    {new Date(event.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {event.actor_name} · Versão {event.version} ·{' '}
                  {event.event_type === 'entry_created' ? 'Cadastro' : 'Alteração'}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(event.changes).map(([field, change]) => (
                    <li key={field}>
                      <span className="font-semibold">{fieldLabels[field] || field}:</span>{' '}
                      <span className="text-muted">
                        {displayValue(field, change.before)} → {displayValue(field, change.after)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  className="mt-2 inline-block text-xs font-bold text-signal"
                  to={`/financeiro/lancamentos/${event.entry_id}/editar`}
                >
                  Abrir lançamento
                </Link>
              </article>
            ))}
          </div>
        )}

        {total > 0 && (
          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" role="status">
              {total === 1 ? '1 evento encontrado' : `${total} eventos encontrados`}
            </p>

            <div className="flex items-center gap-3">
              <button
                className="secondary-button"
                type="button"
                disabled={loading || page <= 1}
                onClick={() => {
                  void search(page - 1)
                }}
              >
                Anterior
              </button>

              <span className="text-sm font-semibold">Página {page}</span>

              <button
                className="secondary-button"
                type="button"
                disabled={loading || !hasNext}
                onClick={() => {
                  void search(page + 1)
                }}
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
          Os resultados são filtrados antes da paginação e respeitam o acesso financeiro da
          organização.
        </p>
      </section>
    </main>
  )
}
