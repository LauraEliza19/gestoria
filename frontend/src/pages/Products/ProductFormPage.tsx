import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../services/api'

type Product = Record<
  string,
  string | number | boolean | null | undefined
> & {
  id: string
}

type FiscalFieldErrors = {
  ncm_code?: string
  cest_code?: string
  fiscal_origin?: string
}

const initialForm = {
  name: '',
  description: '',
  price: '',
  stock_quantity: '0',
  category: 'outros',
  product_type: 'resale',
  unit_of_measure: 'unit',
  cost_price: '',
  min_stock_quantity: '5',
  perishable: false,
  shelf_life_days: '',
  barcode: '',
  ncm_code: '',
  cest_code: '',
  fiscal_origin: '',
}

const numericFields = [
  ['price', 'Preço de venda'],
  ['cost_price', 'Preço de custo'],
  ['stock_quantity', 'Estoque atual'],
  ['min_stock_quantity', 'Estoque mínimo'],
] as const

export function ProductFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = params.get('id')

  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FiscalFieldErrors>({})
  const [loading, setLoading] = useState(Boolean(id))

  useEffect(() => {
    if (!id) return

    apiFetch<Product[]>('/api/products')
      .then((list) => {
        const product = list.find((item) => item.id === id)

        if (!product) {
          setStatus('Produto não encontrado.')
          return
        }

        const loadedForm = Object.fromEntries(
          Object.keys(initialForm).map((key) => {
            const formKey = key as keyof typeof initialForm
            const value = product[key]

            if (typeof value === 'boolean') {
              return [key, value]
            }

            if (value == null) {
              return [key, initialForm[formKey]]
            }

            return [key, String(value)]
          }),
        ) as typeof initialForm

        setForm(loadedForm)
      })
      .catch((error) => {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o produto.',
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  function update(
    field: keyof typeof initialForm,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateFiscal(
    field: keyof FiscalFieldErrors,
    value: string,
    maxLength: number,
  ) {
    const numbersOnly = value.replace(/\D/g, '').slice(0, maxLength)

    update(field, numbersOnly)

    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }))

    setStatus('')
  }

  function decimal(value: string) {
    return value ? Number(value.replace(',', '.')) : null
  }

  function validateFiscalFields() {
    const errors: FiscalFieldErrors = {}

    if (form.ncm_code && !/^\d{8}$/.test(form.ncm_code)) {
      errors.ncm_code = 'O NCM deve conter exatamente 8 números.'
    }

    if (form.cest_code && !/^\d{7}$/.test(form.cest_code)) {
      errors.cest_code = 'O CEST deve conter exatamente 7 números.'
    }

    if (form.fiscal_origin && !/^[0-8]$/.test(form.fiscal_origin)) {
      errors.fiscal_origin =
        'A origem fiscal deve ser um número entre 0 e 8.'
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus('Revise os campos fiscais destacados antes de salvar.')
      return false
    }

    return true
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setStatus('')

    const price = decimal(form.price)

    if (!form.name.trim() || !price || price <= 0) {
      setStatus('Nome e preço de venda válido são obrigatórios.')
      return
    }

    if (form.perishable && !form.shelf_life_days) {
      setStatus('Informe a validade para produtos perecíveis.')
      return
    }

    if (!validateFiscalFields()) return

    try {
      const payload = {
        ...form,
        price,
        stock_quantity: decimal(form.stock_quantity) || 0,
        cost_price: decimal(form.cost_price),
        min_stock_quantity: decimal(form.min_stock_quantity) || 5,
        shelf_life_days:
          form.perishable && form.shelf_life_days
            ? Number(form.shelf_life_days)
            : null,
        fiscal_origin: form.fiscal_origin
          ? Number(form.fiscal_origin)
          : null,
        description: form.description || null,
        barcode: form.barcode || null,
        ncm_code: form.ncm_code || null,
        cest_code: form.cest_code || null,
      }

      await apiFetch(id ? `/api/products/${id}` : '/api/products', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })

      navigate('/produtos')
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o produto.',
      )
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <p className="table-status">Carregando produto...</p>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastro manual</p>
          <h1>{id ? 'Editar produto' : 'Novo produto'}</h1>
          <p>
            Cadastre catálogo, estoque, custos, validade e informações
            fiscais.
          </p>
        </div>

        <Link className="secondary-button" to="/produtos">
          Voltar para produtos
        </Link>
      </header>

      <form className="page-card grid gap-6" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-label md:col-span-2">
            Nome
            <input
              className="form-input"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              required
            />
          </label>

          <label className="form-label md:col-span-2">
            Descrição
            <textarea
              className="form-input min-h-24"
              value={form.description}
              onChange={(event) =>
                update('description', event.target.value)
              }
            />
          </label>

          {numericFields.map(([field, label]) => (
            <label className="form-label" key={field}>
              {label}
              <input
                className="form-input"
                inputMode="decimal"
                value={form[field]}
                onChange={(event) => update(field, event.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-3">
          <label className="form-label">
            Categoria
            <select
              className="form-input"
              value={form.category}
              onChange={(event) =>
                update('category', event.target.value)
              }
            >
              <option value="padaria">Padaria</option>
              <option value="frios">Frios</option>
              <option value="bebidas">Bebidas</option>
              <option value="outros">Outros</option>
            </select>
          </label>

          <label className="form-label">
            Tipo de produto
            <select
              className="form-input"
              value={form.product_type}
              onChange={(event) =>
                update('product_type', event.target.value)
              }
            >
              <option value="resale">Revenda</option>
              <option value="manufactured">Fabricado</option>
            </select>
          </label>

          <label className="form-label">
            Unidade
            <select
              className="form-input"
              value={form.unit_of_measure}
              onChange={(event) =>
                update('unit_of_measure', event.target.value)
              }
            >
              <option value="unit">Unidade</option>
              <option value="kg">Quilograma</option>
              <option value="g">Grama</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-[13px] font-bold text-[#354064] md:col-span-3">
            <input
              type="checkbox"
              checked={form.perishable}
              onChange={(event) =>
                update('perishable', event.target.checked)
              }
            />
            Produto perecível
          </label>

          {form.perishable && (
            <label className="form-label">
              Validade (dias)
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.shelf_life_days}
                onChange={(event) =>
                  update('shelf_life_days', event.target.value)
                }
                required
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 border-t border-line pt-5 md:grid-cols-2 lg:grid-cols-4">
          <p className="eyebrow md:col-span-2 lg:col-span-4">
            Identificação fiscal
          </p>

          <label className="form-label">
            Código de barras
            <input
              className="form-input"
              value={form.barcode}
              onChange={(event) =>
                update('barcode', event.target.value)
              }
            />
            <small className="text-muted">
              Código comercial do produto, quando houver.
            </small>
          </label>

          <label className="form-label">
            NCM
            <input
              className={`form-input ${
                fieldErrors.ncm_code ? 'border-[#d84f62]' : ''
              }`}
              inputMode="numeric"
              maxLength={8}
              value={form.ncm_code}
              onChange={(event) =>
                updateFiscal('ncm_code', event.target.value, 8)
              }
              aria-invalid={Boolean(fieldErrors.ncm_code)}
              aria-describedby="ncm-help"
            />
            <small
              id="ncm-help"
              className={
                fieldErrors.ncm_code
                  ? 'text-[#d84f62]'
                  : 'text-muted'
              }
            >
              {fieldErrors.ncm_code ||
                'Informe exatamente 8 números, sem pontos.'}
            </small>
          </label>

          <label className="form-label">
            CEST
            <input
              className={`form-input ${
                fieldErrors.cest_code ? 'border-[#d84f62]' : ''
              }`}
              inputMode="numeric"
              maxLength={7}
              value={form.cest_code}
              onChange={(event) =>
                updateFiscal('cest_code', event.target.value, 7)
              }
              aria-invalid={Boolean(fieldErrors.cest_code)}
              aria-describedby="cest-help"
            />
            <small
              id="cest-help"
              className={
                fieldErrors.cest_code
                  ? 'text-[#d84f62]'
                  : 'text-muted'
              }
            >
              {fieldErrors.cest_code ||
                'Informe exatamente 7 números, sem pontos.'}
            </small>
          </label>

          <label className="form-label">
            Origem fiscal
            <input
              className={`form-input ${
                fieldErrors.fiscal_origin
                  ? 'border-[#d84f62]'
                  : ''
              }`}
              inputMode="numeric"
              maxLength={1}
              value={form.fiscal_origin}
              onChange={(event) =>
                updateFiscal(
                  'fiscal_origin',
                  event.target.value,
                  1,
                )
              }
              aria-invalid={Boolean(fieldErrors.fiscal_origin)}
              aria-describedby="fiscal-origin-help"
            />
            <small
              id="fiscal-origin-help"
              className={
                fieldErrors.fiscal_origin
                  ? 'text-[#d84f62]'
                  : 'text-muted'
              }
            >
              {fieldErrors.fiscal_origin ||
                'Informe um número entre 0 e 8.'}
            </small>
          </label>
        </div>

        {status && (
          <p className="form-status" role="alert" aria-live="polite">
            {status}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button className="primary-button" type="submit">
            Salvar produto
          </button>

          <Link className="secondary-button" to="/produtos">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}