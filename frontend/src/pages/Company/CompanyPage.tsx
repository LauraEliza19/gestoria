import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { useSession } from '../../contexts/SessionContext'
import { BRAZILIAN_STATES, maskTaxDocument, taxDocumentError } from '../../utils/documents'
import { maskPhoneInput, maskPostalCode } from '../../utils/formatting'

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
  document: 'CNPJ (ou CPF, se não tiver CNPJ)',
  state_registration: 'Inscrição estadual',
  municipal_registration: 'Inscrição municipal',
  phone: 'Telefone',
  postal_code: 'CEP',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado (UF)',
}

const masks: Partial<Record<CompanyField, (value: string) => string>> = {
  document: maskTaxDocument,
  phone: maskPhoneInput,
  postal_code: maskPostalCode,
}

const placeholders: Partial<Record<CompanyField, string>> = {
  document: '00.000.000/0000-00',
  phone: '(35) 3714-2200',
  postal_code: '00000-000',
  street: 'Rua, avenida...',
  number: '123',
}

function createCompanyFromOrganization(organization: Record<string, string | null>): Company {
  const company = Object.fromEntries(
    fields.map((field) => {
      const value = organization[field] ?? ''
      const mask = masks[field]
      return [field, value && mask ? mask(value) : value]
    }),
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
  const [documentTouched, setDocumentTouched] = useState(false)
  const documentProblem = taxDocumentError(data.document)
  const { dirty } = useFormChanges(data)
  const { busy: saving, run: save } = useSaveAction()
  const announceSuccess = useFormSuccess()

  function update(field: CompanyField, value: string) {
    const mask = masks[field]
    setData((current) => ({
      ...current,
      [field]: mask ? mask(value) : value,
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

      if (documentProblem) {
        setDocumentTouched(true)
        setStatus(documentProblem)
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
        {fields.map((field) => {
          const showDocumentError = field === 'document' && documentTouched && documentProblem
          const inputClass = `w-full rounded-lg border-[1.5px] ${
            showDocumentError ? 'border-[#d84f62]' : 'border-[#dde2f0]'
          } bg-white p-3 text-ink outline-none focus:border-signal focus:ring-4 focus:ring-[rgba(61,99,245,.12)]`
          return (
            <label className="grid gap-2 text-[13px] font-bold text-[#354064]" key={field}>
              <span>
                {fieldLabels[field]}
                {field === 'name' && <RequiredMark />}
              </span>
              {field === 'state' ? (
                <select
                  className={inputClass}
                  name={field}
                  value={data.state ?? ''}
                  onChange={(event) => update(field, event.target.value)}
                >
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                  {data.state && !(BRAZILIAN_STATES as readonly string[]).includes(data.state) && (
                    <option value={data.state}>{data.state}</option>
                  )}
                </select>
              ) : (
                <input
                  required={field === 'name'}
                  className={inputClass}
                  name={field}
                  value={data[field] ?? ''}
                  inputMode={masks[field] ? 'numeric' : undefined}
                  placeholder={placeholders[field]}
                  onChange={(event) => update(field, event.target.value)}
                  onBlur={field === 'document' ? () => setDocumentTouched(true) : undefined}
                  aria-invalid={showDocumentError ? true : undefined}
                />
              )}
              {showDocumentError && (
                <small className="font-normal text-[#d84f62]">{documentProblem}</small>
              )}
            </label>
          )
        })}

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
