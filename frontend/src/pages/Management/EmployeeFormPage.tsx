import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { createEmployee, getEmployee, updateEmployee } from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type { EmployeeCreatePayload } from './managementTypes'

type EmployeeFormValues = {
  fullName: string
  document: string
  email: string
  phone: string
  birthDate: string
}

const initialValues: EmployeeFormValues = {
  fullName: '',
  document: '',
  email: '',
  phone: '',
  birthDate: '',
}

export function EmployeeFormPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(employeeId)

  const [values, setValues] = useState<EmployeeFormValues>(initialValues)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    getEmployee(employeeId)
      .then((employee) => {
        if (cancelled) return

        setValues({
          fullName: employee.full_name,
          document: employee.document || '',
          email: employee.email || '',
          phone: employee.phone || '',
          birthDate: employee.birth_date || '',
        })
        setLoading(false)
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar o funcionário.'))
      })

    return () => {
      cancelled = true
    }
  }, [employeeId])

  function updateField(field: keyof EmployeeFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload: EmployeeCreatePayload = {
      full_name: values.fullName.trim(),
      document: values.document.trim() || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      birth_date: values.birthDate || null,
    }

    try {
      if (employeeId) {
        await updateEmployee(employeeId, payload)
      } else {
        await createEmployee(payload)
      }

      navigate('/gestao/funcionarios', {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          editing
            ? 'Não foi possível atualizar o funcionário.'
            : 'Não foi possível cadastrar o funcionário.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando funcionário..." />
      </main>
    )
  }

  if (editing && error && !values.fullName) {
    return (
      <main className="page-wrap">
        <ErrorState message={error} />
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

          <p className="eyebrow">Gestão interna</p>
          <h1>{editing ? 'Editar funcionário' : 'Cadastrar funcionário'}</h1>
          <p>
            Registre os dados essenciais da pessoa. O vínculo profissional será configurado no
            perfil.
          </p>
        </div>
      </header>

      <form className="page-card mx-auto max-w-[900px]" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="form-label md:col-span-2">
            Nome completo
            <input
              className="form-input"
              type="text"
              value={values.fullName}
              maxLength={120}
              required
              autoComplete="name"
              placeholder="Ex.: Maria Silva"
              onChange={(event) => updateField('fullName', event.target.value)}
            />
          </label>

          <label className="form-label">
            Documento
            <input
              className="form-input"
              type="text"
              value={values.document}
              maxLength={18}
              inputMode="numeric"
              placeholder="CPF ou outro documento"
              onChange={(event) => updateField('document', event.target.value)}
            />
          </label>

          <label className="form-label">
            Data de nascimento
            <input
              className="form-input"
              type="date"
              value={values.birthDate}
              onChange={(event) => updateField('birthDate', event.target.value)}
            />
          </label>

          <label className="form-label">
            E-mail
            <input
              className="form-input"
              type="email"
              value={values.email}
              maxLength={255}
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              onChange={(event) => updateField('email', event.target.value)}
            />
          </label>

          <label className="form-label">
            Telefone
            <input
              className="form-input"
              type="tel"
              value={values.phone}
              maxLength={30}
              autoComplete="tel"
              placeholder="(35) 99999-0000"
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className="mt-5 text-sm text-[#d84f62]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link className="secondary-button" to="/gestao/funcionarios">
            Cancelar
          </Link>

          <button className="primary-button gap-2" type="submit" disabled={saving}>
            <Save size={17} aria-hidden="true" />
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </button>
        </div>
      </form>
    </main>
  )
}
