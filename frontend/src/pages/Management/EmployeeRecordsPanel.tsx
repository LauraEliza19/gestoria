import { FileText, Pencil, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/AsyncState'
import { listEmployeeRecords } from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type {
  EmployeeRecordStatus,
  EmployeeRecordSummary,
  EmployeeRecordType,
} from './managementTypes'

type EmployeeRecordsPanelProps = {
  employeeId: string
}

type StatusFilter = EmployeeRecordStatus | ''
type TypeFilter = EmployeeRecordType | ''

const recordTypeLabels: Record<EmployeeRecordType, string> = {
  warning: 'Advertência',
  incident: 'Ocorrência',
  commendation: 'Reconhecimento',
  note: 'Observação',
}

const severityLabels = {
  informational: 'Informativo',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
}

const statusLabels: Record<EmployeeRecordStatus, string> = {
  open: 'Aberto',
  resolved: 'Resolvido',
  cancelled: 'Cancelado',
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function statusClass(status: EmployeeRecordStatus): string {
  if (status === 'resolved') {
    return 'bg-[#effaf6] text-[#268267]'
  }

  if (status === 'cancelled') {
    return 'bg-[#f1f3f8] text-muted'
  }

  return 'bg-[#fff8eb] text-[#c77716]'
}

function severityClass(severity: EmployeeRecordSummary['severity']): string {
  if (severity === 'high') {
    return 'text-[#c73c52]'
  }

  if (severity === 'medium') {
    return 'text-[#c77716]'
  }

  if (severity === 'low') {
    return 'text-signal'
  }

  return 'text-muted'
}

export function EmployeeRecordsPanel({ employeeId }: EmployeeRecordsPanelProps) {
  const [records, setRecords] = useState<EmployeeRecordSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    listEmployeeRecords(employeeId, {
      status: statusFilter || undefined,
      record_type: typeFilter || undefined,
    })
      .then((items) => {
        if (cancelled) return

        setRecords(items)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(
          getErrorMessage(requestError, 'Não foi possível carregar os registros do funcionário.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [employeeId, requestVersion, statusFilter, typeFilter])

  function changeStatusFilter(value: StatusFilter) {
    setLoading(true)
    setError('')
    setStatusFilter(value)
  }

  function changeTypeFilter(value: TypeFilter) {
    setLoading(true)
    setError('')
    setTypeFilter(value)
  }

  function reload() {
    setLoading(true)
    setError('')
    setRequestVersion((current) => current + 1)
  }

  return (
    <section className="page-card mt-5 min-w-0">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="eyebrow">Histórico interno</p>
          <h2 className="font-display text-xl font-semibold">Advertências e ocorrências</h2>
          <p className="mt-2 text-sm text-muted">
            Registros administrativos vinculados ao funcionário.
          </p>
        </div>

        <Link
          className="primary-button gap-2"
          to={`/gestao/funcionarios/${employeeId}/registros/novo`}
        >
          <Plus size={17} aria-hidden="true" />
          Novo registro
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-y border-line py-5 md:grid-cols-2">
        <label className="form-label">
          Filtrar por situação
          <select
            className="form-input"
            value={statusFilter}
            onChange={(event) => changeStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="">Todas as situações</option>
            <option value="open">Abertos</option>
            <option value="resolved">Resolvidos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </label>

        <label className="form-label">
          Filtrar por tipo
          <select
            className="form-input"
            value={typeFilter}
            onChange={(event) => changeTypeFilter(event.target.value as TypeFilter)}
          >
            <option value="">Todos os tipos</option>
            <option value="warning">Advertências</option>
            <option value="incident">Ocorrências</option>
            <option value="commendation">Reconhecimentos</option>
            <option value="note">Observações</option>
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingState message="Carregando registros..." />
      ) : error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-5" role="alert">
          <p className="text-sm text-[#a52c42]">{error}</p>

          <button className="secondary-button mt-4 gap-2" type="button" onClick={reload}>
            <RefreshCw size={16} aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="mt-6 rounded-lg bg-paper p-8 text-center">
          <FileText className="mx-auto text-muted" size={28} aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold">Nenhum registro encontrado</h3>
          <p className="mt-2 text-xs leading-5 text-muted">
            Cadastre o primeiro registro ou altere os filtros selecionados.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
            {records.length}{' '}
            {records.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </p>

          <ol className="mt-4 space-y-4">
            {records.map((employeeRecord) => (
              <li className="rounded-xl border border-line p-5" key={employeeRecord.id}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-signal">
                        {recordTypeLabels[employeeRecord.record_type]}
                      </span>

                      <span
                        className={`text-xs font-semibold ${severityClass(
                          employeeRecord.severity,
                        )}`}
                      >
                        Nível {severityLabels[employeeRecord.severity]}
                      </span>
                    </div>

                    <h3 className="mt-2 break-words font-display text-lg font-semibold">
                      {employeeRecord.title}
                    </h3>

                    <p className="mt-2 text-xs text-muted">
                      Ocorrido em {formatDateTime(employeeRecord.occurred_at)}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      employeeRecord.status,
                    )}`}
                  >
                    {statusLabels[employeeRecord.status]}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-line pt-4">
                  <Link
                    className="inline-flex items-center gap-2 text-sm font-bold text-signal"
                    to={`/gestao/funcionarios/${employeeId}/registros/${employeeRecord.id}`}
                  >
                    <FileText size={15} aria-hidden="true" />
                    Ver detalhes
                  </Link>

                  {employeeRecord.status === 'open' && (
                    <Link
                      className="inline-flex items-center gap-2 text-sm font-bold text-signal"
                      to={`/gestao/funcionarios/${employeeId}/registros/${employeeRecord.id}/editar`}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Editar registro
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
