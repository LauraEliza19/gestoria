import { ArrowLeft, Building2, CheckCircle2, CircleDollarSign, Save, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  createCostCenter,
  getCostCenter,
  updateCostCenter,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type { CostCenterCreatePayload } from './managementTypes'

type CostCenterFormValues = {
  code: string
  name: string
  description: string
  isActive: boolean
}

const initialValues: CostCenterFormValues = {
  code: '',
  name: '',
  description: '',
  isActive: true,
}

export function CostCenterFormPage() {
  const { costCenterId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(costCenterId)

  const [values, setValues] = useState<CostCenterFormValues>(initialValues)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!costCenterId) return

    let cancelled = false

    getCostCenter(costCenterId)
      .then((costCenter) => {
        if (cancelled) return

        setValues({
          code: costCenter.code,
          name: costCenter.name,
          description: costCenter.description || '',
          isActive: costCenter.is_active,
        })
        setLoading(false)
      })
      .catch((requestError) => {
        if (cancelled) return

        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar o centro de custo.'))
      })

    return () => {
      cancelled = true
    }
  }, [costCenterId])

  function updateField(field: keyof CostCenterFormValues, value: string | boolean) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload: CostCenterCreatePayload = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null,
    }

    try {
      if (costCenterId) {
        await updateCostCenter(costCenterId, {
          ...payload,
          is_active: values.isActive,
        })
      } else {
        await createCostCenter(payload)
      }

      navigate('/gestao/centros-de-custo', {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          editing
            ? 'Não foi possível atualizar o centro de custo.'
            : 'Não foi possível cadastrar o centro de custo.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando centro de custo..." />
      </main>
    )
  }

  if (editing && error && !values.name) {
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
            to="/gestao/centros-de-custo"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para centros de custo
          </Link>

          <p className="eyebrow">Gestão interna</p>
          <h1>{editing ? 'Editar centro de custo' : 'Cadastrar centro de custo'}</h1>
          <p>
            Organize uma área da empresa e prepare sua utilização em vínculos, despesas, relatórios
            e planejamento financeiro.
          </p>
        </div>
      </header>

      <form
        className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={handleSubmit}
      >
        <section className="page-card min-w-0">
          <div className="mb-7 flex items-start gap-3 border-b border-line pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-signal">
              <Building2 size={21} aria-hidden="true" />
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold">Identificação</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Dados principais utilizados para reconhecer esta área em todo o sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="form-label">
              Código
              <input
                className="form-input uppercase"
                type="text"
                value={values.code}
                maxLength={30}
                required
                autoFocus
                placeholder="Ex.: ADM"
                onChange={(event) => updateField('code', event.target.value)}
              />
              <span className="text-xs font-normal leading-5 text-muted">
                Identificação curta e única dentro da empresa.
              </span>
            </label>

            <label className="form-label">
              Nome
              <input
                className="form-input"
                type="text"
                value={values.name}
                maxLength={120}
                required
                placeholder="Ex.: Administrativo"
                onChange={(event) => updateField('name', event.target.value)}
              />
              <span className="text-xs font-normal leading-5 text-muted">
                Nome completo apresentado em vínculos e relatórios.
              </span>
            </label>

            <label className="form-label md:col-span-2">
              Descrição
              <textarea
                className="form-input min-h-36 resize-y"
                value={values.description}
                maxLength={500}
                placeholder="Descreva a finalidade, responsabilidades e atividades desta área."
                onChange={(event) => updateField('description', event.target.value)}
              />
              <span className="text-xs font-normal leading-5 text-muted">
                {values.description.length}/500 caracteres
              </span>
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
                  <strong className="block text-sm">Centro de custo ativo</strong>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Centros inativos permanecem no histórico, mas deixam de estar disponíveis para
                    novos vínculos.
                  </span>
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="mt-6 text-sm text-[#d84f62]" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <Link className="secondary-button" to="/gestao/centros-de-custo">
              Cancelar
            </Link>

            <button className="primary-button gap-2" type="submit" disabled={saving}>
              <Save size={17} aria-hidden="true" />
              {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar centro de custo'}
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="page-card">
            <p className="eyebrow">Estrutura preparada</p>
            <h2 className="mt-2 font-display text-lg font-semibold">
              Um cadastro que pode evoluir
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Esta página própria permite ampliar o centro de custo sem limitar a experiência a uma
              janela pequena.
            </p>

            <ul className="mt-5 space-y-4">
              <li className="flex items-start gap-3">
                <Users className="mt-0.5 shrink-0 text-signal" size={18} aria-hidden="true" />
                <span className="text-sm leading-5 text-muted">
                  Funcionários e responsáveis vinculados
                </span>
              </li>

              <li className="flex items-start gap-3">
                <CircleDollarSign
                  className="mt-0.5 shrink-0 text-signal"
                  size={18}
                  aria-hidden="true"
                />
                <span className="text-sm leading-5 text-muted">
                  Orçamento, despesas e acompanhamento financeiro
                </span>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-signal"
                  size={18}
                  aria-hidden="true"
                />
                <span className="text-sm leading-5 text-muted">
                  Histórico e indicadores operacionais
                </span>
              </li>
            </ul>
          </section>

          {editing && (
            <section className="rounded-xl border border-line bg-white/70 p-5">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  values.isActive ? 'bg-[#effaf6] text-[#268267]' : 'bg-[#f1f3f8] text-muted'
                }`}
              >
                {values.isActive ? 'Ativo' : 'Inativo'}
              </span>

              <p className="mt-3 text-sm leading-6 text-muted">
                A alteração de situação será aplicada quando você salvar o formulário.
              </p>
            </section>
          )}
        </aside>
      </form>
    </main>
  )
}
