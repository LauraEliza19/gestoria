import { useEffect, useState } from 'react'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'

type AuditEvent = {
  id: string
  module: string
  entity: string
  entity_id: string
  actor_id: string
  actor_name: string | null
  actor_email: string | null
  action: string
  created_at: string
  result: string
  origin: string
  data: unknown
}
type AuditPageResult = { items: AuditEvent[]; total: number; page: number; has_next: boolean }
const results: Record<string, string> = {
  not_recorded: 'Não registrado',
  prepared: 'Preparado',
  executed: 'Executado',
  cancelled: 'Cancelado',
  rejected: 'Rejeitado',
  denied: 'Negado',
  rate_limited: 'Limite excedido',
  error: 'Erro',
}
const emptyFilters = {
  module: '',
  query: '',
  actor: '',
  action: '',
  entity: '',
  result: '',
  origin: '',
  start_date: '',
  end_date: '',
}
function params(filters: typeof emptyFilters) {
  return new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()))
}

export function AuditPage() {
  const [draft, setDraft] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditPageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    const search = params(filters)
    search.set('page', String(page))
    apiFetch<AuditPageResult>(`/api/audit?${search}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value)
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(getErrorMessage(err, 'Não foi possível consultar a auditoria.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filters, page, attempt])

  async function download() {
    setExporting(true)
    setError('')
    try {
      const blob = await apiFetch<Blob>(`/api/audit/export?${params(filters)}`, {}, 'blob')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'auditoria.csv'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível exportar a auditoria.'))
    } finally {
      setExporting(false)
    }
  }
  function field(name: keyof typeof emptyFilters, label: string, type = 'text') {
    return (
      <label className="grid gap-1 text-sm">
        {label}
        <input
          className="rounded-lg border border-line bg-white px-3 py-2"
          type={type}
          value={draft[name]}
          onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
        />
      </label>
    )
  }
  function selectField(
    name: keyof typeof emptyFilters,
    label: string,
    options: Record<string, string>,
  ) {
    return (
      <label className="grid gap-1 text-sm">
        {label}
        <select
          className="rounded-lg border border-line bg-white px-3 py-2"
          value={draft[name]}
          onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
        >
          <option value="">Todos</option>
          {Object.entries(options).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Central de Auditoria</h1>
          <p className="text-sm text-muted">
            Histórico da empresa nos módulos Financeiro, Fiscal, Pedidos e Copiloto.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={loading || exporting}
          onClick={() => void download()}
        >
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>
      <form
        className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters({ ...draft })
          setPage(1)
        }}
      >
        {selectField(
          'module',
          'Módulo',
          Object.fromEntries(['Financeiro', 'Fiscal', 'Pedidos', 'Copiloto'].map((v) => [v, v])),
        )}
        {field('query', 'Buscar nos registros e dados')}
        {field('actor', 'Usuário (nome, e-mail ou ID)')}
        {field('entity', 'Entidade ou identificador')}
        {field('action', 'Ação')}
        {selectField('result', 'Resultado', results)}
        {selectField('origin', 'Origem', { unknown: 'Não registrada (unknown)' })}
        {field('start_date', 'Data inicial (UTC)', 'date')}
        {field('end_date', 'Data final (UTC)', 'date')}
        <div className="flex gap-3">
          <button className="primary-button" type="submit">
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyFilters)
              setFilters(emptyFilters)
              setPage(1)
            }}
          >
            Limpar
          </button>
        </div>
      </form>
      <p className="text-sm text-muted">
        Datas dos filtros em UTC; horários exibidos no seu fuso local. Origem não registrada aparece
        como unknown. Os dados enviados ao Copiloto são omitidos por privacidade.
      </p>
      {error && (
        <div role="alert" className="rounded-lg border border-red-300 p-4">
          {error} <button onClick={() => setAttempt((v) => v + 1)}>Tentar novamente</button>
        </div>
      )}
      {loading && <p role="status">Consultando auditoria...</p>}
      {!loading && data && (
        <>
          <p role="status">{data.total} evento(s) encontrado(s)</p>
          {data.items.length === 0 ? (
            <p>Nenhum evento encontrado para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      'Módulo',
                      'Entidade / registro',
                      'Usuário',
                      'Ação',
                      'Data e horário',
                      'Resultado',
                      'Origem',
                      'Dados',
                    ].map((label) => (
                      <th className="p-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => (
                    <tr className="border-t border-line align-top" key={event.module + event.id}>
                      <td className="p-3">{event.module}</td>
                      <td className="p-3">
                        {event.entity}
                        <div className="text-xs break-all">{event.entity_id}</div>
                      </td>
                      <td className="p-3">
                        {event.actor_name || event.actor_id}
                        <div className="text-xs">{event.actor_email}</div>
                      </td>
                      <td className="p-3">{event.action}</td>
                      <td className="whitespace-nowrap p-3">
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3">{results[event.result] || event.result}</td>
                      <td className="p-3 text-xs">{event.origin}</td>
                      <td className="p-3">
                        <details>
                          <summary className="cursor-pointer">Ver dados</summary>
                          <pre className="max-h-80 w-80 overflow-auto whitespace-pre-wrap break-words p-2">
                            {event.module === 'Copiloto'
                              ? 'Dados enviados ao Copiloto omitidos por privacidade.'
                              : JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>
              Página {page} de {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            <button disabled={!data.has_next} onClick={() => setPage(page + 1)}>
              Próxima
            </button>
          </div>
        </>
      )}
    </section>
  )
}
