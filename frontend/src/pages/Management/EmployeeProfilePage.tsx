import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Edit3,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { useSession } from '../../contexts/SessionContext'
import { EmployeeRecordsPanel } from './EmployeeRecordsPanel'
import {
  getEmployee,
  getEmploymentCompensation,
  listCostCenters,
  listEmployments,
  updateEmployee,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type {
  CostCenter,
  Employee,
  Employment,
  EmploymentStatus,
  EmploymentType,
} from './managementTypes'

const employmentTypeLabels: Record<EmploymentType, string> = {
  employee: 'Funcionário',
  contractor: 'Prestador de serviço',
  intern: 'Estagiário',
  temporary: 'Temporário',
  partner: 'Sócio',
  other: 'Outro',
}

const employmentStatusLabels: Record<EmploymentStatus, string> = {
  active: 'Ativo',
  on_leave: 'Afastado',
  ended: 'Encerrado',
}

function formatDate(value: string | null): string {
  if (!value) return 'Não informado'

  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatMoney(value: string | null): string {
  if (value === null) return 'Não informado'

  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const { can } = useSession()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employments, setEmployments] = useState<Employment[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [compensations, setCompensations] = useState<Record<string, string | null>>({})
  const [loadingCompensationId, setLoadingCompensationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    Promise.all([getEmployee(employeeId), listEmployments(employeeId), listCostCenters()])
      .then(([employeeData, employmentItems, costCenterItems]) => {
        if (cancelled) return

        setEmployee(employeeData)
        setEmployments(employmentItems)
        setCostCenters(costCenterItems)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(
          getErrorMessage(requestError, 'Não foi possível carregar o perfil do funcionário.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [employeeId, requestVersion])

  function reload() {
    setLoading(true)
    setError('')
    setRequestVersion((current) => current + 1)
  }

  async function toggleEmployeeStatus() {
    if (!employee) return

    setUpdating(true)
    setError('')

    try {
      const updated = await updateEmployee(employee.id, {
        is_active: !employee.is_active,
      })
      setEmployee(updated)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível alterar a situação do funcionário.'))
    } finally {
      setUpdating(false)
    }
  }

  async function loadCompensation(employmentId: string) {
    setLoadingCompensationId(employmentId)
    setError('')

    try {
      const compensation = await getEmploymentCompensation(employmentId)

      setCompensations((current) => ({
        ...current,
        [employmentId]: compensation.base_salary,
      }))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível consultar a remuneração.'))
    } finally {
      setLoadingCompensationId(null)
    }
  }

  function hideCompensation(employmentId: string) {
    setCompensations((current) => {
      const updated = { ...current }
      delete updated[employmentId]
      return updated
    })
  }

  function costCenterName(costCenterId: string | null): string {
    if (!costCenterId) return 'Sem centro de custo'

    return (
      costCenters.find((item) => item.id === costCenterId)?.name || 'Centro de custo indisponível'
    )
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando perfil do funcionário..." />
      </main>
    )
  }

  if (!employee) {
    return (
      <main className="page-wrap">
        <ErrorState message={error || 'Funcionário não encontrado.'} onRetry={reload} />
      </main>
    )
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal"
            to="/gestao/funcionarios"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para funcionários
          </Link>

          <p className="eyebrow">Perfil do funcionário</p>
          <h1>{employee.full_name}</h1>
          <p>Dados pessoais e histórico profissional dentro da empresa.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            className="secondary-button gap-2"
            type="button"
            disabled={updating}
            onClick={() => void toggleEmployeeStatus()}
          >
            {employee.is_active ? (
              <UserX size={17} aria-hidden="true" />
            ) : (
              <UserCheck size={17} aria-hidden="true" />
            )}
            {updating ? 'Atualizando...' : employee.is_active ? 'Desativar' : 'Reativar'}
          </button>

          <Link className="primary-button gap-2" to={`/gestao/funcionarios/${employee.id}/editar`}>
            <Edit3 size={17} aria-hidden="true" />
            Editar dados
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="mb-5 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-4 text-sm text-[#a52c42]"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.4fr]">
        <article className="page-card">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-signal">
              <UserCheck size={20} aria-hidden="true" />
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold">Dados pessoais</h2>
              <span
                className={`mt-1 inline-block text-xs font-semibold ${
                  employee.is_active ? 'text-[#268267]' : 'text-muted'
                }`}
              >
                {employee.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Documento</dt>
              <dd className="mt-1 break-words">{employee.document || 'Não informado'}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">E-mail</dt>
              <dd className="mt-1 break-words">{employee.email || 'Não informado'}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Telefone</dt>
              <dd className="mt-1">{employee.phone || 'Não informado'}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Nascimento</dt>
              <dd className="mt-1">{formatDate(employee.birth_date)}</dd>
            </div>
          </dl>
        </article>

        <article className="page-card min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Histórico profissional</p>
              <h2 className="font-display text-xl font-semibold">Vínculos</h2>
            </div>

            {employee.is_active && (
              <Link
                className="primary-button gap-2"
                to={`/gestao/funcionarios/${employee.id}/vinculos/novo`}
              >
                <BriefcaseBusiness size={17} aria-hidden="true" />
                Novo vínculo
              </Link>
            )}
          </div>

          {employments.length === 0 ? (
            <div className="rounded-lg bg-paper p-7 text-center">
              <BriefcaseBusiness className="mx-auto text-muted" size={26} aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">Nenhum vínculo registrado</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Cadastre o primeiro vínculo profissional deste funcionário.
              </p>
            </div>
          ) : (
            <ol className="space-y-4">
              {employments.map((employment) => {
                const compensationVisible = employment.id in compensations

                return (
                  <li className="rounded-xl border border-line p-5" key={employment.id}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold">
                          {employment.position_title}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {employmentTypeLabels[employment.employment_type]}
                          {' · '}
                          {costCenterName(employment.cost_center_id)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          employment.status === 'active'
                            ? 'bg-[#effaf6] text-[#268267]'
                            : employment.status === 'on_leave'
                              ? 'bg-[#fff8eb] text-[#c77716]'
                              : 'bg-[#f1f3f8] text-muted'
                        }`}
                      >
                        {employmentStatusLabels[employment.status]}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays size={15} aria-hidden="true" />
                        Início: {formatDate(employment.started_at)}
                      </span>

                      {employment.ended_at && (
                        <span>Encerramento: {formatDate(employment.ended_at)}</span>
                      )}
                    </div>

                    {employment.notes && (
                      <p className="mt-4 text-sm leading-6 text-muted">{employment.notes}</p>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                      <Link
                        className="text-sm font-bold text-signal"
                        to={`/gestao/funcionarios/${employee.id}/vinculos/${employment.id}/editar`}
                      >
                        Editar vínculo
                      </Link>

                      {can('employee_compensation:read') &&
                        (compensationVisible ? (
                          <>
                            <strong className="text-sm">
                              {formatMoney(compensations[employment.id])}
                            </strong>
                            <button
                              className="inline-flex items-center gap-2 text-sm font-bold text-muted"
                              type="button"
                              onClick={() => hideCompensation(employment.id)}
                            >
                              <EyeOff size={16} aria-hidden="true" />
                              Ocultar
                            </button>
                          </>
                        ) : (
                          <button
                            className="inline-flex items-center gap-2 text-sm font-bold text-signal"
                            type="button"
                            disabled={loadingCompensationId === employment.id}
                            onClick={() => void loadCompensation(employment.id)}
                          >
                            <Eye size={16} aria-hidden="true" />
                            {loadingCompensationId === employment.id
                              ? 'Consultando...'
                              : 'Ver remuneração'}
                          </button>
                        ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </article>
      </section>

      <EmployeeRecordsPanel employeeId={employee.id} />
    </main>
  )
}
