import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type Customer = Record<
  string,
  string | number | boolean | null | undefined
> & {
  id: string
}

const initialForm = {
  name: '',
  phone: '',
  person_type: 'individual',
  document: '',
  trade_name: '',
  state_registration: '',
  whatsapp: '',
  email: '',
  birth_date: '',
  category: 'final_consumer',
  default_discount_percent: '',
  notes: '',
  postal_code: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

const identificationFields = [
  ['name', 'Nome completo / Razão social'],
  ['phone', 'Telefone'],
  ['document', 'CPF / CNPJ'],
  ['trade_name', 'Nome fantasia'],
  ['state_registration', 'Inscrição estadual'],
] as const

const relationshipFields = [
  ['whatsapp', 'WhatsApp'],
  ['email', 'E-mail'],
  ['birth_date', 'Data de nascimento'],
  ['default_discount_percent', 'Desconto padrão (%)'],
] as const

const addressFields = [
  ['postal_code', 'CEP'],
  ['street', 'Rua'],
  ['number', 'Número'],
  ['complement', 'Complemento'],
  ['neighborhood', 'Bairro'],
  ['city', 'Cidade'],
  ['state', 'Estado (UF)'],
] as const

export function CustomerFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = params.get('id')

  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(Boolean(id))

  useEffect(() => {
    if (!id) return

    apiFetch<Customer[]>('/api/customers')
      .then((list) => {
        const customer = list.find((item) => item.id === id)

        if (!customer) {
          setStatus('Cliente não encontrado.')
          return
        }

        const loadedForm = Object.fromEntries(
          Object.keys(initialForm).map((key) => {
            const formKey = key as keyof typeof initialForm
            const value = customer[key]

            return [
              key,
              value == null
                ? initialForm[formKey]
                : String(value),
            ]
          }),
        ) as typeof initialForm

        setForm(loadedForm)
      })
      .catch((error) => {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o cliente.',
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  function update(
    field: keyof typeof initialForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setStatus('')

    if (!form.name.trim() || !form.phone.trim()) {
      setStatus('Nome e telefone são obrigatórios.')
      return
    }

    try {
      const nullableFields = [
        'document',
        'trade_name',
        'state_registration',
        'whatsapp',
        'notes',
        'postal_code',
        'street',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
      ] as const

      const payload = {
        ...form,
        email: form.email || null,
        birth_date: form.birth_date || null,
        default_discount_percent:
          form.default_discount_percent
            ? form.default_discount_percent.replace(',', '.')
            : null,
        ...Object.fromEntries(
          nullableFields.map((field) => [
            field,
            form[field] || null,
          ]),
        ),
      }

      await apiFetch(
        id ? `/api/customers/${id}` : '/api/customers',
        {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      )

      navigate('/clientes')
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o cliente.',
      )
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <p className="table-status">Carregando cliente...</p>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastro manual</p>
          <h1>{id ? 'Editar cliente' : 'Novo cliente'}</h1>
          <p>
            Preencha os dados comerciais, pessoais e de endereço.
          </p>
        </div>

        <Link className="secondary-button" to="/clientes">
          Voltar para clientes
        </Link>
      </header>

      <form className="page-card grid gap-6" onSubmit={submit}>
        <div>
          <p className="eyebrow mb-4">
            Identificação do cliente
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-label">
              Tipo de pessoa
              <select
                className="form-input"
                value={form.person_type}
                onChange={(event) =>
                  update('person_type', event.target.value)
                }
              >
                <option value="individual">Pessoa física</option>
                <option value="company">Pessoa jurídica</option>
              </select>
            </label>

            <label className="form-label">
              Categoria do cliente
              <select
                className="form-input"
                value={form.category}
                onChange={(event) =>
                  update('category', event.target.value)
                }
              >
                <option value="final_consumer">
                  Consumidor final
                </option>
                <option value="reseller">Revendedor</option>
                <option value="event">Cliente de eventos</option>
              </select>
            </label>

            {identificationFields.map(([field, label]) => (
              <label className="form-label" key={field}>
                {label}
                <input
                  className="form-input"
                  value={form[field]}
                  onChange={(event) =>
                    update(field, event.target.value)
                  }
                  required={
                    field === 'name' || field === 'phone'
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="eyebrow mb-4">
            Contato e relacionamento
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {relationshipFields.map(([field, label]) => (
              <label className="form-label" key={field}>
                {label}
                <input
                  className="form-input"
                  type={
                    field === 'email'
                      ? 'email'
                      : field === 'birth_date'
                        ? 'date'
                        : 'text'
                  }
                  inputMode={
                    field === 'default_discount_percent'
                      ? 'decimal'
                      : undefined
                  }
                  value={form[field]}
                  onChange={(event) =>
                    update(field, event.target.value)
                  }
                />
              </label>
            ))}

            <label className="form-label md:col-span-3">
              Observações
              <textarea
                className="form-input min-h-24"
                value={form.notes}
                onChange={(event) =>
                  update('notes', event.target.value)
                }
              />
            </label>
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="eyebrow mb-4">Endereço</p>

          <div className="grid gap-4 md:grid-cols-4">
            {addressFields.map(([field, label]) => (
              <label
                className={`form-label ${
                  field === 'street'
                    ? 'md:col-span-2'
                    : ''
                }`}
                key={field}
              >
                {label}
                <input
                  className="form-input"
                  value={form[field]}
                  onChange={(event) =>
                    update(field, event.target.value)
                  }
                  maxLength={field === 'state' ? 2 : undefined}
                />
              </label>
            ))}
          </div>
        </div>

        {status && (
          <p
            className="form-status"
            role="alert"
            aria-live="polite"
          >
            {status}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button className="primary-button" type="submit">
            Salvar cliente
          </button>

          <Link className="secondary-button" to="/clientes">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}