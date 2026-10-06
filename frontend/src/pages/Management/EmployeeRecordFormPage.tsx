import { ArrowLeft, FileText, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  createEmployeeRecord,
  getEmployee,
  getEmployeeRecord,
  updateEmployeeRecord,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type {
  Employee,
  EmployeeRecordCreatePayload,
  EmployeeRecordSeverity,
  EmployeeRecordType,
} from './managementTypes'

type EmployeeRecordFormValues = {
  recordType: EmployeeRecordType
  severity: EmployeeRecordSeverity
  title: string
  description: string
  occurredAt: string
}

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function createInitialValues(): EmployeeRecordFormValues {
  return {
    recordType: 'warning',
    severity: 'medium',
    title: '',
    description: '',
    occurredAt: toLocalDateTimeInput(new Date().toISOString()),
  }
}

export function EmployeeRecordFormPage() {
  const { employeeId, recordId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(recordId)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [values, setValues] = useState<EmployeeRecordFormValues>(createInitialValues)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    const recordRequest = recordId ? getEmployeeRecord(recordId) : Promise.resolve(null)

    Promise.all([getEmployee(employeeId), recordRequest])
      .then(([employeeData, employeeRecord]) => {
        if (cancelled) return

        if (employeeRecord && employeeRecord.employee_id !== employeeData.id) {
          throw new Error('O registro não pertence ao funcionário informado.')
        }

        if (employeeRecord && employeeRecord.status !== 'open') {
          throw new Error('Somente registros abertos podem ser editados.')
        }

        setEmployee(employeeData)

        if (employeeRecord) {
          setValues({
            recordType: employeeRecord.record_type,
            severity: employeeRecord.severity,
            title: employeeRecord.title,
            description: employeeRecord.description,
            occurredAt: toLocalDateTimeInput(employeeRecord.occurred_at),
          })
        }

        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setEmployee(null)
        setError(
          getErrorMessage(requestError, 'Não foi possível carregar o formulário do registro.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [employeeId, recordId])

  function updateField(field: keyof EmployeeRecordFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!employeeId || !values.occurredAt) return

    setSaving(true)
    setError('')

    const payload: EmployeeRecordCreatePayload = {
      record_type: values.recordType,
      severity: values.severity,
      title: values.title.trim(),
      description: values.description.trim(),
      occurred_at: new Date(values.occurredAt).toISOString(),
    }

    try {
      if (recordId) {
        await updateEmployeeRecord(recordId, payload)
      } else {
        await createEmployeeRecord(employeeId, payload)
      }

      navigate(`/gestao/funcionarios/${employeeId}`, {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          editing
            ? 'Não foi possível atualizar o registro.'
            : 'Não foi possível cadastrar o registro.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando formulário do registro..." />
      </main>
    )
  }

  if (!employee) {
    return (
      <main className="page-wrap">
        <ErrorState message={error || 'Funcionário não encontrado.'} />
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

          <p className="eyebrow">Gestão de pessoas</p>
          <h1>{editing ? 'Editar registro' : 'Novo registro'}</h1>
          <p>
            Registre advertências, ocorrências, reconhecimentos e observações de{' '}
            {employee.full_name}.
          </p>
        </div>
      </header>

      <form className="w-full pb-10" onSubmit={handleSubmit}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-signal">
            <FileText size={20} aria-hidden="true" />
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold">Dados do registro</h2>
            <p className="mt-1 text-xs text-muted">
              Registros resolvidos ou cancelados permanecerão no histórico.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="form-label">
            Tipo de registro
            <select
              className="form-input"
              value={values.recordType}
              onChange={(event) => updateField('recordType', event.target.value)}
            >
              <option value="warning">Advertência</option>
              <option value="incident">Ocorrência</option>
              <option value="commendation">Reconhecimento</option>
              <option value="note">Observação</option>
            </select>
          </label>

          <label className="form-label">
            Nível
            <select
              className="form-input"
              value={values.severity}
              onChange={(event) => updateField('severity', event.target.value)}
            >
              <option value="informational">Informativo</option>
              <option value="low">Baixo</option>
              <option value="medium">Médio</option>
              <option value="high">Alto</option>
            </select>
          </label>

          <label className="form-label md:col-span-2">
            Título
            <input
              className="form-input"
              type="text"
              value={values.title}
              maxLength={160}
              required
              placeholder="Ex.: Descumprimento de procedimento interno"
              onChange={(event) => updateField('title', event.target.value)}
            />
          </label>

          <label className="form-label md:col-span-2">
            Data e horário da ocorrência
            <input
              className="form-input"
              type="datetime-local"
              value={values.occurredAt}
              max={toLocalDateTimeInput(new Date().toISOString())}
              required
              onChange={(event) => updateField('occurredAt', event.target.value)}
            />
          </label>

          <label className="form-label md:col-span-2">
            Descrição
            <textarea
              className="form-input min-h-44 resize-y"
              value={values.description}
              maxLength={4000}
              required
              placeholder="Descreva o fato de maneira clara, objetiva e profissional."
              onChange={(event) => updateField('description', event.target.value)}
            />
            <span className="mt-1 text-right text-xs font-normal text-muted">
              {values.description.length}/4000 caracteres
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-5 text-sm text-[#d84f62]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link className="secondary-button" to={`/gestao/funcionarios/${employee.id}`}>
            Cancelar
          </Link>

          <button className="primary-button gap-2" type="submit" disabled={saving}>
            <Save size={17} aria-hidden="true" />
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar registro'}
          </button>
        </div>
      </form>
    </main>
  )
}
