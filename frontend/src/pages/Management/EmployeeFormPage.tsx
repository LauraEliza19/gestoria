import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
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
  const { busy: saving, run: save } = useSaveAction()
  const { dirty, resetBaseline } = useFormChanges(values)
  const announceSuccess = useFormSuccess()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!employeeId) return

    let cancelled = false

    getEmployee(employeeId)
      .then((employee) => {
        if (cancelled) return

        const loadedValues = {
          fullName: employee.full_name,
          document: employee.document || '',
          email: employee.email || '',
          phone: employee.phone || '',
          birthDate: employee.birth_date || '',
        }
        setValues(loadedValues)
        resetBaseline(loadedValues)
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
  }, [employeeId, resetBaseline])

  function updateField(field: keyof EmployeeFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save(async () => {
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

        announceSuccess(editing ? 'Funcionário atualizado.' : 'Funcionário cadastrado.')
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
      }
    })
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
      <FormHeader
        module="Gestão interna"
        title={editing ? 'Editar funcionário' : 'Novo funcionário'}
        description="Registre os dados essenciais. Os vínculos são configurados no perfil."
        mode={editing ? 'edit' : 'create'}
        back={{ to: '/gestao/funcionarios', label: 'Voltar para funcionários' }}
        dirty={dirty}
        blocked={saving}
      />

      <SavingForm
        className="page-card mx-auto max-w-[900px]"
        onSubmit={handleSubmit}
        saving={saving}
        onInvalidCapture={() => setError('')}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="form-label md:col-span-2">
            <span>
              Nome completo
              <RequiredMark />
            </span>
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
          <FormExit to="/gestao/funcionarios" blocked={saving} dirty={dirty}>
            Cancelar
          </FormExit>

          <SaveButton saving={saving} icon={<Save size={17} aria-hidden="true" />}>
            {editing ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </SaveButton>
        </div>
      </SavingForm>
    </main>
  )
}
