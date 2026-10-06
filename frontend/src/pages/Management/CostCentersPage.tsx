import { Building2, Edit3, Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { listCostCenters, updateCostCenter } from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type { CostCenter } from './managementTypes'

type StatusFilter = 'all' | 'active' | 'inactive'

export function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    listCostCenters()
      .then((items) => {
        if (cancelled) return

        setCostCenters(items)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar os centros de custo.'))
      })

    return () => {
      cancelled = true
    }
  }, [requestVersion])

  const filteredCostCenters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')

    return costCenters.filter((costCenter) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && costCenter.is_active) ||
        (statusFilter === 'inactive' && !costCenter.is_active)

      const matchesQuery =
        !normalizedQuery ||
        costCenter.code.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
        costCenter.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
        (costCenter.description || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [costCenters, query, statusFilter])

  function reload() {
    setLoading(true)
    setError('')
    setSuccess('')
    setRequestVersion((current) => current + 1)
  }

  async function toggleStatus(costCenter: CostCenter) {
    setUpdatingId(costCenter.id)
    setError('')
    setSuccess('')

    try {
      const updated = await updateCostCenter(costCenter.id, {
        is_active: !costCenter.is_active,
      })

      setCostCenters((current) => current.map((item) => (item.id === updated.id ? updated : item)))

      setSuccess(
        updated.is_active
          ? 'Centro de custo reativado com sucesso.'
          : 'Centro de custo desativado com sucesso.',
      )
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'Não foi possível alterar a situação do centro de custo.'),
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestão interna</p>
          <h1>Centros de custo</h1>
          <p>
            Organize as áreas da empresa utilizadas nos vínculos, despesas e relatórios internos.
          </p>
        </div>

        <Link className="primary-button gap-2" to="/gestao/centros-de-custo/novo">
          <Plus size={17} aria-hidden="true" />
          Novo centro de custo
        </Link>
      </header>

      <section className="page-card min-w-0">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow">Estrutura empresarial</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Áreas cadastradas</h2>
            <p className="mt-2 text-sm text-muted">
              Consulte, edite ou altere a situação dos registros.
            </p>
          </div>

          <span className="w-fit rounded-full bg-[#f2f5ff] px-3 py-1 text-xs font-semibold text-signal">
            {costCenters.length} {costCenters.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <span className="sr-only">Buscar centro de custo</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              size={18}
              aria-hidden="true"
            />
            <input
              className="form-input pl-11"
              type="search"
              value={query}
              placeholder="Buscar por código, nome ou descrição"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Todas as situações</option>
              <option value="active">Somente ativos</option>
              <option value="inactive">Somente inativos</option>
            </select>
          </label>
        </div>

        {success && (
          <p
            className="mb-5 rounded-xl border border-[#bfe5d8] bg-[#effaf6] px-4 py-3 text-sm text-[#26725c]"
            role="status"
          >
            {success}
          </p>
        )}

        {error && costCenters.length > 0 && (
          <p
            className="mb-5 rounded-xl border border-[#f2c8cf] bg-[#fff3f5] px-4 py-3 text-sm text-[#b33d50]"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <LoadingState message="Carregando centros de custo..." />
        ) : error && costCenters.length === 0 ? (
          <ErrorState message={error} onRetry={reload} />
        ) : costCenters.length === 0 ? (
          <EmptyState
            title="Nenhum centro de custo cadastrado"
            description="Cadastre a primeira área para organizar vínculos e despesas."
          />
        ) : filteredCostCenters.length === 0 ? (
          <EmptyState
            title="Nenhum resultado encontrado"
            description="Altere a busca ou o filtro para visualizar outros registros."
          />
        ) : (
          <ul className="space-y-3">
            {filteredCostCenters.map((costCenter) => (
              <li
                className="rounded-xl border border-line p-4 transition-shadow hover:shadow-sm"
                key={costCenter.id}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f2f5ff] text-signal">
                      <Building2 size={20} aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-mono text-xs text-signal">{costCenter.code}</strong>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            costCenter.is_active
                              ? 'bg-[#effaf6] text-[#268267]'
                              : 'bg-[#f1f3f8] text-muted'
                          }`}
                        >
                          {costCenter.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-lg font-semibold">{costCenter.name}</h3>

                      <p className="mt-1 text-sm leading-6 text-muted">
                        {costCenter.description || 'Sem descrição'}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      className="secondary-button gap-2"
                      to={`/gestao/centros-de-custo/${costCenter.id}/editar`}
                    >
                      <Edit3 size={16} aria-hidden="true" />
                      Editar
                    </Link>

                    <button
                      className="secondary-button gap-2"
                      type="button"
                      disabled={updatingId === costCenter.id}
                      onClick={() => void toggleStatus(costCenter)}
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      {updatingId === costCenter.id
                        ? 'Atualizando...'
                        : costCenter.is_active
                          ? 'Desativar'
                          : 'Reativar'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
