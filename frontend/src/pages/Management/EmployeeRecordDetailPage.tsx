import { ArrowLeft, Ban, CheckCircle2, Edit3, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  cancelEmployeeRecord,
  getEmployee,
  getEmployeeRecord,
  resolveEmployeeRecord,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type {
  Employee,
  EmployeeRecord,
  EmployeeRecordSeverity,
  EmployeeRecordStatus,
  EmployeeRecordType,
} from './managementTypes'

type ActionMode = 'resolve' | 'cancel' | null

const recordTypeLabels: Record<EmployeeRecordType, string> = {
  warning: 'Advertência',
  incident: 'Ocorrência',
  commendation: 'Reconhecimento',
  note: 'Observação',
}

const severityLabels: Record<EmployeeRecordSeverity, string> = {
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

function formatDateTime(value: string | null): string {
  if (!value) return 'Não informado'

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

export function EmployeeRecordDetailPage() {
  const { employeeId, recordId } = useParams()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employeeRecord, setEmployeeRecord] = useState<EmployeeRecord | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [actionText, setActionText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    if (!employeeId || !recordId) return

    let cancelled = false

    Promise.all([getEmployee(employeeId), getEmployeeRecord(recordId)])
      .then(([employeeData, recordData]) => {
        if (cancelled) return

        if (recordData.employee_id !== employeeData.id) {
          throw new Error('O registro não pertence ao funcionário informado.')
        }

        setEmployee(employeeData)
        setEmployeeRecord(recordData)
        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(
          getErrorMessage(requestError, 'Não foi possível carregar o registro do funcionário.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [employeeId, recordId, requestVersion])

  function reload() {
    setLoading(true)
    setError('')
    setRequestVersion((current) => current + 1)
  }

  function openAction(mode: Exclude<ActionMode, null>) {
    setActionMode(mode)
    setActionText('')
    setActionError('')
  }

  function closeAction() {
    setActionMode(null)
    setActionText('')
    setActionError('')
  }

  async function handleAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!employeeRecord || !actionMode) return

    setSaving(true)
    setActionError('')

    try {
      const updated =
        actionMode === 'resolve'
          ? await resolveEmployeeRecord(employeeRecord.id, {
              resolution_notes: actionText.trim(),
            })
          : await cancelEmployeeRecord(employeeRecord.id, {
              cancellation_reason: actionText.trim(),
            })

      setEmployeeRecord(updated)
      closeAction()
    } catch (requestError) {
      setActionError(
        getErrorMessage(
          requestError,
          actionMode === 'resolve'
            ? 'Não foi possível resolver o registro.'
            : 'Não foi possível cancelar o registro.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando registro..." />
      </main>
    )
  }

  if (!employee || !employeeRecord) {
    return (
      <main className="page-wrap">
        <ErrorState message={error || 'Registro não encontrado.'} onRetry={reload} />
      </main>
    )
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal"
            to={`/gestao/funcionarios/${employee.id}`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para o perfil
          </Link>

          <p className="eyebrow">Histórico interno</p>
          <h1>{employeeRecord.title}</h1>
          <p>Registro administrativo de {employee.full_name}.</p>
        </div>

        {employeeRecord.status === 'open' && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              className="secondary-button gap-2"
              to={`/gestao/funcionarios/${employee.id}/registros/${employeeRecord.id}/editar`}
            >
              <Edit3 size={17} aria-hidden="true" />
              Editar
            </Link>

            <button
              className="secondary-button gap-2"
              type="button"
              onClick={() => openAction('cancel')}
            >
              <Ban size={17} aria-hidden="true" />
              Cancelar registro
            </button>

            <button
              className="primary-button gap-2"
              type="button"
              onClick={() => openAction('resolve')}
            >
              <CheckCircle2 size={17} aria-hidden="true" />
              Resolver
            </button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_0.8fr]">
        <article className="page-card min-w-0">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-signal">
              <FileText size={20} aria-hidden="true" />
            </div>

            <div>
              <p className="eyebrow">{recordTypeLabels[employeeRecord.record_type]}</p>
              <h2 className="font-display text-xl font-semibold">Descrição do registro</h2>
            </div>
          </div>

          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {employeeRecord.description}
          </p>
        </article>

        <aside className="page-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Informações</h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                employeeRecord.status,
              )}`}
            >
              {statusLabels[employeeRecord.status]}
            </span>
          </div>

          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Tipo</dt>
              <dd className="mt-1">{recordTypeLabels[employeeRecord.record_type]}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Nível</dt>
              <dd className="mt-1">{severityLabels[employeeRecord.severity]}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Data da ocorrência</dt>
              <dd className="mt-1">{formatDateTime(employeeRecord.occurred_at)}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Criado em</dt>
              <dd className="mt-1">{formatDateTime(employeeRecord.created_at)}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Última atualização</dt>
              <dd className="mt-1">{formatDateTime(employeeRecord.updated_at)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {employeeRecord.status === 'resolved' && (
        <section className="mt-5 rounded-xl border border-[#cbe8dd] bg-[#f4fbf8] p-6">
          <p className="eyebrow text-[#268267]">Resolução</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Registro resolvido</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
            {employeeRecord.resolution_notes}
          </p>
          <p className="mt-4 text-xs text-muted">
            Resolvido em {formatDateTime(employeeRecord.resolved_at)}
          </p>
        </section>
      )}

      {employeeRecord.status === 'cancelled' && (
        <section className="mt-5 rounded-xl border border-line bg-[#f7f8fb] p-6">
          <p className="eyebrow">Cancelamento</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Registro cancelado</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
            {employeeRecord.cancellation_reason}
          </p>
          <p className="mt-4 text-xs text-muted">
            Cancelado em {formatDateTime(employeeRecord.cancelled_at)}
          </p>
        </section>
      )}

      {actionMode && employeeRecord.status === 'open' && (
        <section className="mt-5 border-t border-line pt-7">
          <form className="w-full" onSubmit={handleAction}>
            <div className="max-w-[900px]">
              <p className="eyebrow">
                {actionMode === 'resolve' ? 'Encerrar ocorrência' : 'Cancelar registro'}
              </p>

              <h2 className="mt-2 font-display text-2xl font-semibold">
                {actionMode === 'resolve'
                  ? 'Informar resolução'
                  : 'Informar motivo do cancelamento'}
              </h2>

              <p className="mt-2 text-sm text-muted">
                {actionMode === 'resolve'
                  ? 'Explique como a situação foi tratada e concluída.'
                  : 'O conteúdo continuará disponível no histórico para auditoria.'}
              </p>

              <label className="form-label mt-6">
                {actionMode === 'resolve' ? 'Descrição da resolução' : 'Motivo do cancelamento'}

                <textarea
                  className="form-input min-h-36 resize-y"
                  value={actionText}
                  required
                  minLength={actionMode === 'cancel' ? 3 : 1}
                  maxLength={actionMode === 'resolve' ? 4000 : 500}
                  autoFocus
                  placeholder={
                    actionMode === 'resolve'
                      ? 'Descreva as providências tomadas.'
                      : 'Informe por que este registro está sendo cancelado.'
                  }
                  onChange={(event) => setActionText(event.target.value)}
                />
              </label>

              {actionError && (
                <p className="mt-4 text-sm text-[#d84f62]" role="alert">
                  {actionError}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={closeAction}
                >
                  Voltar
                </button>

                <button className="primary-button gap-2" type="submit" disabled={saving}>
                  {actionMode === 'resolve' ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <Ban size={17} aria-hidden="true" />
                  )}

                  {saving
                    ? 'Salvando...'
                    : actionMode === 'resolve'
                      ? 'Confirmar resolução'
                      : 'Confirmar cancelamento'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </main>
  )
}
