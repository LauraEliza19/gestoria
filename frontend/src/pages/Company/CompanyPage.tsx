import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

  function update(field: CompanyField, value: string) {
    setData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      navigate('/dashboard')
    } catch (error) {
      setStatus(getErrorMessage(error, 'Não foi possível salvar os dados da empresa.'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] p-7 md:p-16">
      <header className="mb-9 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[.08em] text-signal">
            Configurações
          </p>
          <h1 className="font-display text-[clamp(28px,4vw,42px)] font-semibold tracking-[-.04em]">
            Dados da empresa
          </h1>
          <p className="mt-2 text-sm text-muted">
            Mantenha as informações da organização atualizadas.
          </p>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-3 text-[13px] font-bold text-[#354064]"
          to="/dashboard"
        >
          Voltar
        </Link>
      </header>

      <form
        className="grid max-w-[850px] grid-cols-1 gap-[18px] rounded-[10px] border border-line bg-white p-6 shadow-[0_8px_24px_rgba(17,25,54,.04)] md:grid-cols-2"
        onSubmit={submit}
      >
        {fields.map((field) => (
          <label className="grid gap-2 text-[13px] font-bold text-[#354064]" key={field}>
            {fieldLabels[field]}
            <input
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

        <button
          className="inline-flex w-fit items-center justify-center rounded-lg bg-signal px-4 py-3 text-[13px] font-bold text-white transition hover:bg-signal-dark"
          type="submit"
        >
          Salvar alterações
        </button>
      </form>
    </div>
  )
}
