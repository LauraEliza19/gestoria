import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { apiFetch, apiFetchItems } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import { BRAZILIAN_STATES, maskTaxDocument, taxDocumentError } from '../../utils/documents'
import { maskPhoneInput, maskPostalCode } from '../../utils/formatting'

type Customer = Record<string, string | number | boolean | null | undefined> & {
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
] as const

type FormField = keyof typeof initialForm

// Máscaras aplicadas enquanto a pessoa digita; o servidor confere de novo ao salvar.
const masks: Partial<Record<FormField, (value: string) => string>> = {
  phone: maskPhoneInput,
  whatsapp: maskPhoneInput,
  document: maskTaxDocument,
  postal_code: maskPostalCode,
}

const placeholders: Partial<Record<FormField, string>> = {
  phone: '(35) 99999-8888',
  whatsapp: '(35) 99999-8888',
  document: '000.000.000-00 ou 00.000.000/0000-00',
  postal_code: '00000-000',
  email: 'nome@exemplo.com.br',
}

export function CustomerFormPage() {
  const [params] = useSearchParams()
  const id = params.get('id')
  return <CustomerForm key={id ?? 'new'} id={id} />
}

function CustomerForm({ id }: { id: string | null }) {
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const { dirty, resetBaseline } = useFormChanges(form)
  const { busy: saving, run: save } = useSaveAction()
  const announceSuccess = useFormSuccess()
  const [status, setStatus] = useState('')
  const [documentTouched, setDocumentTouched] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const documentProblem = taxDocumentError(form.document, form.person_type)

  useEffect(() => {
    if (!id) return

    apiFetchItems<Customer>('/api/customers')
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
            if (value == null) return [key, initialForm[formKey]]
            const mask = masks[formKey]
            return [key, mask ? mask(String(value)) : String(value)]
          }),
        ) as typeof initialForm

        setForm(loadedForm)
        resetBaseline(loadedForm)
      })
      .catch((error) => {
        setStatus(getErrorMessage(error, 'Não foi possível carregar o cliente.'))
      })
      .finally(() => setLoading(false))
  }, [id, resetBaseline])

  function update(field: keyof typeof initialForm, value: string) {
    const mask = masks[field]
    setForm((current) => ({
      ...current,
      [field]: mask ? mask(value) : value,
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    await save(async () => {
      setStatus('')

      if (!form.name.trim() || !form.phone.trim()) {
        setStatus('Nome e telefone são obrigatórios.')
        return
      }

      if (documentProblem) {
        setDocumentTouched(true)
        setStatus(documentProblem)
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
          default_discount_percent: form.default_discount_percent
            ? form.default_discount_percent.replace(',', '.')
            : null,
          ...Object.fromEntries(nullableFields.map((field) => [field, form[field] || null])),
        }

        await apiFetch(id ? `/api/customers/${id}` : '/api/customers', {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        })

        announceSuccess(id ? 'Cliente atualizado.' : 'Cliente cadastrado.')
        navigate('/clientes')
      } catch (error) {
        setStatus(getErrorMessage(error, 'Não foi possível salvar o cliente.'))
      }
    })
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
      <FormHeader
        module="Clientes"
        title={id ? 'Editar cliente' : 'Novo cliente'}
        description="Preencha os dados comerciais, pessoais e de endereço."
        mode={id ? 'edit' : 'create'}
        back={{ to: '/clientes', label: 'Voltar para clientes' }}
        dirty={dirty}
        blocked={saving}
      />

      <SavingForm
        className="page-card grid gap-6"
        onSubmit={submit}
        saving={saving}
        onInvalidCapture={() => setStatus('')}
      >
        <div>
          <p className="eyebrow mb-4">Identificação do cliente</p>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-label">
              Tipo de pessoa
              <select
                className="form-input"
                value={form.person_type}
                onChange={(event) => update('person_type', event.target.value)}
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
                onChange={(event) => update('category', event.target.value)}
              >
                <option value="final_consumer">Consumidor final</option>
                <option value="reseller">Revendedor</option>
                <option value="event">Cliente de eventos</option>
              </select>
            </label>

            {identificationFields.map(([field, label]) => {
              const showDocumentError = field === 'document' && documentTouched && documentProblem
              return (
                <label className="form-label" key={field}>
                  <span>
                    {label}
                    {(field === 'name' || field === 'phone') && <RequiredMark />}
                  </span>
                  <input
                    className={`form-input ${showDocumentError ? 'border-[#d84f62]' : ''}`}
                    value={form[field]}
                    inputMode={field === 'phone' || field === 'document' ? 'numeric' : undefined}
                    placeholder={placeholders[field]}
                    onChange={(event) => update(field, event.target.value)}
                    onBlur={field === 'document' ? () => setDocumentTouched(true) : undefined}
                    aria-invalid={showDocumentError ? true : undefined}
                    aria-describedby={field === 'document' ? 'customer-document-help' : undefined}
                    required={field === 'name' || field === 'phone'}
                  />
                  {field === 'document' && (
                    <small
                      id="customer-document-help"
                      className={showDocumentError ? 'text-[#d84f62]' : 'text-muted'}
                    >
                      {showDocumentError
                        ? documentProblem
                        : 'CPF para pessoa física, CNPJ para pessoa jurídica.'}
                    </small>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="eyebrow mb-4">Contato e relacionamento</p>

          <div className="grid gap-4 md:grid-cols-3">
            {relationshipFields.map(([field, label]) => (
              <label className="form-label" key={field}>
                {label}
                <input
                  className="form-input"
                  type={field === 'email' ? 'email' : field === 'birth_date' ? 'date' : 'text'}
                  inputMode={
                    field === 'default_discount_percent'
                      ? 'decimal'
                      : field === 'whatsapp'
                        ? 'numeric'
                        : undefined
                  }
                  placeholder={placeholders[field]}
                  value={form[field]}
                  onChange={(event) => update(field, event.target.value)}
                />
              </label>
            ))}

            <label className="form-label md:col-span-3">
              Observações
              <textarea
                className="form-input min-h-24"
                value={form.notes}
                onChange={(event) => update('notes', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="eyebrow mb-4">Endereço</p>

          <div className="grid gap-4 md:grid-cols-4">
            {addressFields.map(([field, label]) => (
              <label
                className={`form-label ${field === 'street' ? 'md:col-span-2' : ''}`}
                key={field}
              >
                {label}
                <input
                  className="form-input"
                  value={form[field]}
                  inputMode={field === 'postal_code' ? 'numeric' : undefined}
                  placeholder={placeholders[field]}
                  onChange={(event) => update(field, event.target.value)}
                />
              </label>
            ))}

            <label className="form-label">
              Estado (UF)
              <select
                className="form-input"
                value={form.state}
                onChange={(event) => update('state', event.target.value)}
              >
                <option value="">Selecione</option>
                {BRAZILIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
                {form.state && !(BRAZILIAN_STATES as readonly string[]).includes(form.state) && (
                  <option value={form.state}>{form.state}</option>
                )}
              </select>
            </label>
          </div>
        </div>

        {status && (
          <p className="form-status" role="alert" aria-live="polite">
            {status}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <SaveButton saving={saving}>Salvar cliente</SaveButton>
          <FormExit to="/clientes" blocked={saving} dirty={dirty}>
            Cancelar
          </FormExit>
        </div>
      </SavingForm>
    </div>
  )
}
