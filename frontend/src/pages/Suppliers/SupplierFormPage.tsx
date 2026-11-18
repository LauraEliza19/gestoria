import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { createSupplier, getSupplier, updateSupplier } from '../../services/suppliers.service'
import { getErrorMessage } from '../../utils/errors'
import {
  maskPhoneInput,
  maskTaxIdInput,
  onlyDigits,
  supplierFormErrors,
  supplierPayload,
} from '../Fiscal/fiscalUtils'

type SupplierFormValues = {
  name: string
  document: string
  phone: string
  email: string
  isActive: boolean
}

type SupplierField = 'name' | 'document' | 'phone' | 'email'

const initialValues: SupplierFormValues = {
  name: '',
  document: '',
  phone: '',
  email: '',
  isActive: true,
}

const SUPPLIERS_PATH = '/fornecedores'

// Campos que só são validados quando o usuário os altera: cadastros antigos podem
// ter documento ou contato fora do padrão atual e ainda assim precisam ser editáveis.
const VALIDATED_ON_CHANGE: SupplierField[] = ['document', 'phone', 'email']

export function SupplierFormPage() {
  const { supplierId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(supplierId)

  const [values, setValues] = useState<SupplierFormValues>(initialValues)
  const [loadedValues, setLoadedValues] = useState<SupplierFormValues | null>(null)
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState('')
  const { busy: saving, run: save } = useSaveAction()
  const { dirty, resetBaseline } = useFormChanges(values)
  const announceSuccess = useFormSuccess()
  const [error, setError] = useState('')
  const [touched, setTouched] = useState<Partial<Record<SupplierField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  const errors = supplierFormErrors(values)
  for (const field of VALIDATED_ON_CHANGE) {
    if (loadedValues && values[field] === loadedValues[field]) delete errors[field]
  }
  const hasErrors = Object.keys(errors).length > 0

  useEffect(() => {
    if (!supplierId) return

    let cancelled = false

    getSupplier(supplierId)
      .then((supplier) => {
        if (cancelled) return

        const stored: SupplierFormValues = {
          name: supplier.name,
          document: onlyDigits(supplier.document),
          phone: onlyDigits(supplier.phone),
          email: supplier.email || '',
          isActive: supplier.is_active,
        }
        setValues(stored)
        setLoadedValues(stored)
        resetBaseline(stored)
        setLoading(false)
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setLoadError(getErrorMessage(requestError, 'Não foi possível carregar o fornecedor.'))
      })

    return () => {
      cancelled = true
    }
  }, [supplierId, resetBaseline])

  function updateField(field: keyof SupplierFormValues, value: string | boolean) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function markTouched(field: SupplierField) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function fieldError(field: SupplierField) {
    return submitted || touched[field] ? errors[field] || '' : ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setError('')

    if (hasErrors) return

    await save(async () => {
      const payload = supplierPayload(values)

      try {
        if (supplierId) {
          await updateSupplier(supplierId, {
            ...payload,
            is_active: values.isActive,
          })
        } else {
          await createSupplier(payload)
        }

        announceSuccess(editing ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
        navigate(SUPPLIERS_PATH, {
          replace: true,
        })
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            editing
              ? 'Não foi possível atualizar o fornecedor.'
              : 'Não foi possível cadastrar o fornecedor.',
          ),
        )
      }
    })
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <LoadingState message="Carregando fornecedor..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-wrap">
        <ErrorState message={loadError} />

        <p className="mt-5 text-center">
          <Link className="secondary-button" to={SUPPLIERS_PATH}>
            Voltar para fornecedores
          </Link>
        </p>
      </div>
    )
  }

  const nameError = fieldError('name')
  const documentError = fieldError('document')
  const phoneError = fieldError('phone')
  const emailError = fieldError('email')

  return (
    <div className="page-wrap">
      <FormHeader
        module="Cadastros"
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        description="Dados usados nas notas de entrada e nas contas da empresa."
        mode={editing ? 'edit' : 'create'}
        back={{ to: SUPPLIERS_PATH, label: 'Voltar para fornecedores' }}
        dirty={dirty}
        blocked={saving}
      />

      <SavingForm className="max-w-[850px]" onSubmit={handleSubmit} saving={saving} noValidate>
        <section className="page-card min-w-0">
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
            <label className="form-label min-w-0 md:col-span-2">
              <span>
                Nome ou razão social
                <RequiredMark />
              </span>
              <input
                className="form-input"
                type="text"
                value={values.name}
                maxLength={160}
                required
                aria-required="true"
                aria-invalid={Boolean(nameError)}
                aria-describedby="supplier-name-hint"
                autoFocus={!editing}
                placeholder="Ex.: Moinho Central Ltda"
                onBlur={() => markTouched('name')}
                onChange={(event) => updateField('name', event.target.value)}
              />
              <small
                id="supplier-name-hint"
                className={nameError ? 'fiscal-field-error' : 'fiscal-field-hint'}
                role={nameError ? 'alert' : undefined}
              >
                {nameError || 'Como consta na nota fiscal do fornecedor.'}
              </small>
            </label>

            <label className="form-label min-w-0">
              <span>
                CPF/CNPJ
                <RequiredMark />
              </span>
              <input
                className="form-input"
                type="text"
                value={maskTaxIdInput(values.document)}
                maxLength={18}
                required
                aria-required="true"
                aria-invalid={Boolean(documentError)}
                aria-describedby="supplier-document-hint"
                inputMode="numeric"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                onBlur={() => markTouched('document')}
                onChange={(event) =>
                  updateField('document', onlyDigits(event.target.value).slice(0, 14))
                }
              />
              <small
                id="supplier-document-hint"
                className={`supplier-field-message ${documentError ? 'fiscal-field-error' : 'fiscal-field-hint'}`}
                role={documentError ? 'alert' : undefined}
              >
                {documentError ||
                  `CPF com 11 dígitos ou CNPJ com 14 dígitos (${values.document.length} informados).`}
              </small>
            </label>

            <label className="form-label min-w-0">
              <span>Telefone</span>
              <input
                className="form-input"
                type="tel"
                value={maskPhoneInput(values.phone)}
                maxLength={15}
                aria-invalid={Boolean(phoneError)}
                aria-describedby="supplier-phone-hint"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                onBlur={() => markTouched('phone')}
                onChange={(event) =>
                  updateField('phone', onlyDigits(event.target.value).slice(0, 11))
                }
              />
              <small
                id="supplier-phone-hint"
                className={`supplier-field-message ${phoneError ? 'fiscal-field-error' : 'fiscal-field-hint'}`}
                role={phoneError ? 'alert' : undefined}
              >
                {phoneError || 'Opcional. Informe com DDD.'}
              </small>
            </label>

            <label className="form-label min-w-0 md:col-span-2">
              <span>E-mail</span>
              <input
                className="form-input"
                type="email"
                value={values.email}
                maxLength={254}
                aria-invalid={Boolean(emailError)}
                aria-describedby="supplier-email-hint"
                inputMode="email"
                placeholder="compras@fornecedor.com.br"
                onBlur={() => markTouched('email')}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <small
                id="supplier-email-hint"
                className={emailError ? 'fiscal-field-error' : 'fiscal-field-hint'}
                role={emailError ? 'alert' : undefined}
              >
                {emailError || 'Opcional.'}
              </small>
            </label>
          </div>

          {editing && (
            <div className="mt-7 border-t border-line pt-6">
              <h2 className="font-display text-lg font-semibold">Situação</h2>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition-colors hover:bg-[#fafbfe]">
                <input
                  className="mt-1 h-4 w-4 accent-[#3d63f5]"
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(event) => updateField('isActive', event.target.checked)}
                />

                <span>
                  <strong className="block text-sm">Fornecedor ativo</strong>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Fornecedores inativos permanecem no histórico, mas deixam de aparecer para novas
                    notas de entrada.
                  </span>
                </span>
              </label>

              <p className="info-note mb-0 mt-4">
                Notas já registradas guardam o nome e o CPF/CNPJ informados na época. Alterações
                valem apenas para as próximas notas.
              </p>
            </div>
          )}

          {submitted && hasErrors && (
            <p className="mt-6 text-sm font-semibold text-[#c2334a]" role="alert">
              Revise os campos destacados antes de salvar.
            </p>
          )}

          {error && (
            <p className="mt-6 text-sm text-[#d84f62]" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <FormExit to={SUPPLIERS_PATH} blocked={saving} dirty={dirty}>
              Cancelar
            </FormExit>

            <SaveButton saving={saving} icon={<Save size={17} aria-hidden="true" />}>
              {editing ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </SaveButton>
          </div>
        </section>
      </SavingForm>
    </div>
  )
}
