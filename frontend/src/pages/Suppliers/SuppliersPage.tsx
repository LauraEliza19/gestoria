import { Edit3, Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useSession } from '../../contexts/SessionContext'
import { listAllSuppliers, updateSupplier } from '../../services/suppliers.service'
import type { Supplier } from '../../services/suppliers.service'
import { getErrorMessage } from '../../utils/errors'
import { formatPhone, formatTaxId, onlyDigits } from '../Fiscal/fiscalUtils'

type StatusFilter = 'all' | 'active' | 'inactive'

export function SuppliersPage() {
  const { can } = useSession()
  const canManage = can('fiscal:manage')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    listAllSuppliers()
      .then((items) => {
        if (cancelled) return

        setSuppliers(items)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar os fornecedores.'))
      })

    return () => {
      cancelled = true
    }
  }, [requestVersion])

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    const queryDigits = onlyDigits(query)

    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && supplier.is_active) ||
        (statusFilter === 'inactive' && !supplier.is_active)

      const matchesQuery =
        !normalizedQuery ||
        supplier.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
        (supplier.email || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
        (queryDigits.length >= 3 &&
          (onlyDigits(supplier.document).includes(queryDigits) ||
            onlyDigits(supplier.phone).includes(queryDigits)))

      return matchesStatus && matchesQuery
    })
  }, [suppliers, query, statusFilter])

  function reload() {
    setLoading(true)
    setError('')
    setSuccess('')
    setRequestVersion((current) => current + 1)
  }

  async function toggleStatus(supplier: Supplier) {
    setUpdatingId(supplier.id)
    setError('')
    setSuccess('')

    try {
      const updated = await updateSupplier(supplier.id, {
        is_active: !supplier.is_active,
      })

      setSuppliers((current) => current.map((item) => (item.id === updated.id ? updated : item)))

      setSuccess(
        updated.is_active
          ? `${updated.name} foi reativado e voltou a aparecer nas notas de entrada.`
          : `${updated.name} foi desativado e não aparece mais para novas notas. O histórico foi mantido.`,
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível alterar a situação do fornecedor.'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastros</p>
          <h1>Fornecedores</h1>
          <p>Mantenha os fornecedores usados nas notas de entrada e nas contas da empresa.</p>
        </div>

        {canManage && (
          <Link className="primary-button gap-2" to="/fornecedores/novo">
            <Plus size={17} aria-hidden="true" />
            Novo fornecedor
          </Link>
        )}
      </header>

      <section className="page-card min-w-0">
        {!canManage && (
          <p className="info-note">
            Seu perfil pode consultar os fornecedores. Cadastro, edição e desativação são feitos por
            proprietários e administradores.
          </p>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <span className="sr-only">Buscar fornecedor</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              size={18}
              aria-hidden="true"
            />
            <input
              className="form-input pl-11"
              type="search"
              value={query}
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
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

        {error && suppliers.length > 0 && (
          <p
            className="mb-5 rounded-xl border border-[#f2c8cf] bg-[#fff3f5] px-4 py-3 text-sm text-[#b33d50]"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <LoadingState message="Carregando fornecedores..." />
        ) : error && suppliers.length === 0 ? (
          <ErrorState message={error} onRetry={reload} />
        ) : suppliers.length === 0 ? (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            description={
              canManage
                ? 'Cadastre o primeiro fornecedor para registrar notas de entrada.'
                : 'Os fornecedores cadastrados pela empresa aparecerão aqui.'
            }
          />
        ) : filteredSuppliers.length === 0 ? (
          <EmptyState
            title="Nenhum resultado encontrado"
            description="Altere a busca ou o filtro para visualizar outros fornecedores."
          />
        ) : (
          <>
            <p className="mb-4 text-xs text-muted" role="status">
              {filteredSuppliers.length}{' '}
              {filteredSuppliers.length === 1
                ? 'fornecedor encontrado'
                : 'fornecedores encontrados'}
            </p>

            <div className="data-table suppliers-table">
              <div className="data-table-row data-table-head">
                <span>Fornecedor</span>
                <span>Telefone</span>
                <span>E-mail</span>
                <span>Situação</span>
                <span>Ações</span>
              </div>

              {filteredSuppliers.map((supplier) => (
                <div className="data-table-row" key={supplier.id}>
                  <span>
                    <strong>{supplier.name}</strong>
                    <small>{formatTaxId(supplier.document)}</small>
                  </span>

                  <span>{supplier.phone ? formatPhone(supplier.phone) : 'Não informado'}</span>

                  <span>{supplier.email || 'Não informado'}</span>

                  <span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        supplier.is_active
                          ? 'bg-[#effaf6] text-[#268267]'
                          : 'bg-[#f1f3f8] text-muted'
                      }`}
                    >
                      {supplier.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </span>

                  {canManage ? (
                    <span className="suppliers-actions">
                      <Link to={`/fornecedores/${supplier.id}/editar`}>
                        <Edit3 size={14} aria-hidden="true" />
                        Editar
                      </Link>

                      <button
                        type="button"
                        disabled={updatingId === supplier.id}
                        onClick={() => void toggleStatus(supplier)}
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        {updatingId === supplier.id
                          ? 'Atualizando...'
                          : supplier.is_active
                            ? 'Desativar'
                            : 'Reativar'}
                      </button>
                    </span>
                  ) : (
                    <span>Somente consulta</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
