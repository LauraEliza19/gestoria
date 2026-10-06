import { ArrowLeft, BriefcaseBusiness, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { useSession } from '../../contexts/SessionContext'
import {
  createEmployment,
  getEmployee,
  getEmploymentCompensation,
  listCostCenters,
  listEmployments,
  updateEmployment,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type {
  CostCenter,
  Employee,
  EmploymentCreatePayload,
  EmploymentStatus,
  EmploymentType,
} from './managementTypes'

type EmploymentFormValues = {
  costCenterId: string
  positionTitle: string
  employmentType: EmploymentType
  status: EmploymentStatus
  startedAt: string
  endedAt: string
  baseSalary: string
  notes: string
}

const initialValues: EmploymentFormValues = {
  costCenterId: '',
  positionTitle: '',
  employmentType: 'employee',
  status: 'active',
  startedAt: '',
  endedAt: '',
  baseSalary: '',
  notes: '',
}

export function EmploymentFormPage() {
  const { employeeId, employmentId } = useParams()
  const navigate = useNavigate()
  const { can } = useSession()
  const editing = Boolean(employmentId)
  const canReadCompensation = can('employee_compensation:read')

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [values, setValues] = useState<EmploymentFormValues>(initialValues)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    const employmentRequest = employmentId ? listEmployments(employeeId) : Promise.resolve([])

    const compensationRequest =
      employmentId && canReadCompensation
        ? getEmploymentCompensation(employmentId)
        : Promise.resolve(null)

    Promise.all([
      getEmployee(employeeId),
      listCostCenters(),
      employmentRequest,
      compensationRequest,
    ])
      .then(([employeeData, costCenterItems, employmentItems, compensation]) => {
        if (cancelled) return

        setEmployee(employeeData)
        setCostCenters(costCenterItems)

        if (employmentId) {
          const employment = employmentItems.find((item) => item.id === employmentId)

          if (!employment) {
            throw new Error('Vínculo profissional não encontrado.')
          }

          setValues({
            costCenterId: employment.cost_center_id || '',
            positionTitle: employment.position_title,
            employmentType: employment.employment_type,
            status: employment.status,
            startedAt: employment.started_at,
            endedAt: employment.ended_at || '',
            baseSalary: compensation?.base_salary || '',
            notes: employment.notes || '',
          })
        }

        setLoading(false)
        setError('')
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(
          getErrorMessage(requestError, 'Não foi possível carregar o formulário de vínculo.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [canReadCompensation, employeeId, employmentId])

  function updateField(field: keyof EmploymentFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateStatus(status: EmploymentStatus) {
    setValues((current) => ({
      ...current,
      status,
      endedAt: status === 'ended' ? current.endedAt : '',
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!employeeId) return

    setSaving(true)
    setError('')

    const payload: EmploymentCreatePayload = {
      cost_center_id: values.costCenterId || null,
      position_title: values.positionTitle.trim(),
      employment_type: values.employmentType,
      status: values.status,
      started_at: values.startedAt,
      ended_at: values.status === 'ended' ? values.endedAt || null : null,
      notes: values.notes.trim() || null,
    }

    if (canReadCompensation) {
      payload.base_salary = values.baseSalary.trim() || null
    }

    try {
      if (employmentId) {
        await updateEmployment(employmentId, payload)
      } else {
        await createEmployment(employeeId, payload)
      }

      navigate(`/gestao/funcionarios/${employeeId}`, {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          editing
            ? 'Não foi possível atualizar o vínculo.'
            : 'Não foi possível cadastrar o vínculo.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando formulário de vínculo..." />
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

          <p className="eyebrow">Gestão interna</p>
          <h1>{editing ? 'Editar vínculo' : 'Novo vínculo'}</h1>
          <p>Configure a relação profissional de {employee.full_name}.</p>
        </div>
      </header>

      <form className="page-card mx-auto max-w-[900px]" onSubmit={handleSubmit}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-signal">
            <BriefcaseBusiness size={20} aria-hidden="true" />
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold">Dados profissionais</h2>
            <p className="mt-1 text-xs text-muted">
              Os vínculos encerrados permanecem no histórico.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="form-label md:col-span-2">
            Cargo ou função
            <input
              className="form-input"
              type="text"
              value={values.positionTitle}
              maxLength={120}
              required
              placeholder="Ex.: Analista administrativo"
              onChange={(event) => updateField('positionTitle', event.target.value)}
            />
          </label>

          <label className="form-label">
            Tipo de vínculo
            <select
              className="form-input"
              value={values.employmentType}
              onChange={(event) => updateField('employmentType', event.target.value)}
            >
              <option value="employee">Funcionário</option>
              <option value="contractor">Prestador de serviço</option>
              <option value="intern">Estagiário</option>
              <option value="temporary">Temporário</option>
              <option value="partner">Sócio</option>
              <option value="other">Outro</option>
            </select>
          </label>

          <label className="form-label">
            Centro de custo
            <select
              className="form-input"
              value={values.costCenterId}
              onChange={(event) => updateField('costCenterId', event.target.value)}
            >
              <option value="">Sem centro de custo</option>
              {costCenters.map((costCenter) => (
                <option value={costCenter.id} key={costCenter.id}>
                  {costCenter.code} — {costCenter.name}
                  {costCenter.is_active ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label">
            Situação
            <select
              className="form-input"
              value={values.status}
              onChange={(event) => updateStatus(event.target.value as EmploymentStatus)}
            >
              <option value="active">Ativo</option>
              <option value="on_leave">Afastado</option>
              <option value="ended">Encerrado</option>
            </select>
          </label>

          <label className="form-label">
            Data de início
            <input
              className="form-input"
              type="date"
              value={values.startedAt}
              required
              onChange={(event) => updateField('startedAt', event.target.value)}
            />
          </label>

          {values.status === 'ended' && (
            <label className="form-label">
              Data de encerramento
              <input
                className="form-input"
                type="date"
                value={values.endedAt}
                min={values.startedAt || undefined}
                required
                onChange={(event) => updateField('endedAt', event.target.value)}
              />
            </label>
          )}

          {canReadCompensation && (
            <label className="form-label">
              Salário-base
              <input
                className="form-input"
                type="number"
                value={values.baseSalary}
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                onChange={(event) => updateField('baseSalary', event.target.value)}
              />
            </label>
          )}

          <label className="form-label md:col-span-2">
            Observações
            <textarea
              className="form-input min-h-28 resize-y"
              value={values.notes}
              maxLength={1000}
              placeholder="Informações adicionais sobre o vínculo"
              onChange={(event) => updateField('notes', event.target.value)}
            />
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
            {saving ? 'Salvando...' : editing ? 'Salvar vínculo' : 'Cadastrar vínculo'}
          </button>
        </div>
      </form>
    </main>
  )
}
