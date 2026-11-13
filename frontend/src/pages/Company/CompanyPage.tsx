import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useSession } from '../../contexts/SessionContext'

const fields = [
  'name',
  'document',
  'state_registration',
  'municipal_registration',
  'phone',
  'postal_code',
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
] as const

type CompanyField = (typeof fields)[number]
type Company = Record<CompanyField, string | null>

const fieldLabels: Record<CompanyField, string> = {
  name: 'Nome da empresa',
  document: 'CNPJ',
  state_registration: 'Inscrição estadual',
  municipal_registration: 'Inscrição municipal',
  phone: 'Telefone',
  postal_code: 'CEP',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado',
}

function createCompanyFromOrganization(organization: Record<string, string | null>): Company {
  const company = Object.fromEntries(
    fields.map((field) => [field, organization[field] ?? '']),
  ) as Company

  if (company.name === 'Empresa Demo GestorIA') {
    company.name = ''
  }

  return company
}

export function CompanyPage() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [data, setData] = useState<Company>(() =>
    createCompanyFromOrganization(session.organization),
  )
  const [status, setStatus] = useState('')
  const { dirty } = useFormChanges(data)
  const { busy: saving, run: save } = useSaveAction()
  const announceSuccess = useFormSuccess()

  function update(field: CompanyField, value: string) {
    setData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save(async () => {
      setStatus('')

      if (!data.name?.trim()) {
        setStatus('O nome da empresa é obrigatório.')
        return
      }

      const payload = Object.fromEntries(fields.map((field) => [field, data[field] || null]))

      try {
        await apiFetch('/api/organization', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        announceSuccess('Dados da empresa atualizados.')
        navigate('/dashboard')
      } catch (error) {
        setStatus(getErrorMessage(error, 'Não foi possível salvar os dados da empresa.'))
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] p-7 md:p-16">
      <FormHeader
        module="Configurações da empresa"
        title="Dados da empresa"
        description="Atualize as informações da sua organização."
        mode="edit"
        back={{ to: '/dashboard', label: 'Voltar ao painel' }}
        dirty={dirty}
        blocked={saving}
      />

      <SavingForm
        className="grid max-w-[850px] grid-cols-1 gap-[18px] rounded-[10px] border border-line bg-white p-6 shadow-[0_8px_24px_rgba(17,25,54,.04)] md:grid-cols-2"
        onSubmit={submit}
        saving={saving}
        onInvalidCapture={() => setStatus('')}
      >
        {fields.map((field) => (
          <label className="grid gap-2 text-[13px] font-bold text-[#354064]" key={field}>
            <span>
              {fieldLabels[field]}
              {field === 'name' && <RequiredMark />}
            </span>
            <input
              required={field === 'name'}
              className="w-full rounded-lg border-[1.5px] border-[#dde2f0] bg-white p-3 text-ink outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)]"
              name={field}
              value={data[field] ?? ''}
              onChange={(event) => update(field, event.target.value)}
            />
          </label>
        ))}

        {status && (
          <p className="col-span-full text-[13px] text-[#d84f62]" role="alert" aria-live="polite">
            {status}
          </p>
        )}

        <div className="col-span-full flex flex-wrap gap-3">
          <SaveButton saving={saving}>Salvar alterações</SaveButton>
          <FormExit to="/dashboard" blocked={saving} dirty={dirty}>
            Cancelar
          </FormExit>
        </div>
      </SavingForm>
    </div>
  )
}
