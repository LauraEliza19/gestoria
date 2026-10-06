import { Search, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { listEmployees } from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type { EmployeeSummary } from './managementTypes'

type StatusFilter = 'all' | 'active' | 'inactive'

export function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    listEmployees()
      .then((items) => {
        if (cancelled) return

        setEmployees(items)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar os funcionários.'))
      })

    return () => {
      cancelled = true
    }
  }, [requestVersion])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')

    return employees.filter((employee) => {
      const matchesSearch =
        !normalizedSearch ||
        employee.full_name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        employee.email?.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        employee.phone?.includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && employee.is_active) ||
        (statusFilter === 'inactive' && !employee.is_active)

      return matchesSearch && matchesStatus
    })
  }, [employees, search, statusFilter])

  function reload() {
    setLoading(true)
    setError('')
    setRequestVersion((current) => current + 1)
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestão interna</p>
          <h1>Funcionários</h1>
          <p>Organize pessoas, contatos e vínculos profissionais da empresa.</p>
        </div>

        <Link className="primary-button gap-2" to="/gestao/funcionarios/novo">
          <UserPlus size={17} aria-hidden="true" />
          Cadastrar funcionário
        </Link>
      </header>

      <section className="page-card">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <span className="sr-only">Pesquisar funcionários</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              size={18}
              aria-hidden="true"
            />
            <input
              className="form-input pl-11"
              type="search"
              value={search}
              placeholder="Nome, e-mail ou telefone"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Todos os funcionários</option>
              <option value="active">Somente ativos</option>
              <option value="inactive">Somente inativos</option>
            </select>
          </label>
        </div>

        {loading ? (
          <LoadingState message="Carregando funcionários..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : employees.length === 0 ? (
          <EmptyState
            title="Nenhum funcionário cadastrado"
            description="Cadastre a primeira pessoa para começar a estruturar sua equipe."
          />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            title="Nenhum resultado encontrado"
            description="Altere a pesquisa ou o filtro de situação."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredEmployees.map((employee) => (
              <li
                className="rounded-xl border border-line bg-white p-5 transition hover:border-[#b8c6ef] hover:shadow-[0_8px_24px_rgba(17,25,54,.05)]"
                key={employee.id}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-signal">
                    <Users size={21} aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-semibold">
                          {employee.full_name}
                        </h2>
                        <p className="mt-1 truncate text-sm text-muted">
                          {employee.email || employee.phone || 'Contato não informado'}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          employee.is_active
                            ? 'bg-[#effaf6] text-[#268267]'
                            : 'bg-[#f1f3f8] text-muted'
                        }`}
                      >
                        {employee.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <Link
                      className="mt-5 inline-flex text-sm font-bold text-signal"
                      to={`/gestao/funcionarios/${employee.id}`}
                    >
                      Ver perfil e vínculos
                    </Link>
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
