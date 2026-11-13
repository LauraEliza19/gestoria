import { Landmark, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormExit, SaveButton, SavingForm } from '../../components/forms/FormActions'
import { FormHeader, RequiredMark } from '../../components/forms/FormHeader'
import { useFormChanges, useFormSuccess, useSaveAction } from '../../components/forms/useFormState'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  createFinanceCategory,
  getFinanceCategory,
  updateFinanceCategory,
} from '../../services/finance.service'
import { getErrorMessage } from '../../utils/errors'

export function FinanceCategoryFormPage() {
  const { categoryId } = useParams()
  return <FinanceCategoryForm key={categoryId ?? 'new'} categoryId={categoryId} />
}

function FinanceCategoryForm({ categoryId }: { categoryId: string | undefined }) {
  const navigate = useNavigate()
  const editing = Boolean(categoryId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(editing)
  const { busy: saving, run: save } = useSaveAction()
  const { dirty, resetBaseline } = useFormChanges({ name, description, isActive })
  const announceSuccess = useFormSuccess()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!categoryId) return
    getFinanceCategory(categoryId)
      .then((category) => {
        setName(category.name)
        setDescription(category.description || '')
        setIsActive(category.is_active)
        resetBaseline({
          name: category.name,
          description: category.description || '',
          isActive: category.is_active,
        })
        setLoading(false)
      })
      .catch((requestError) => {
        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar a categoria.'))
      })
  }, [categoryId, resetBaseline])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save(async () => {
      setError('')
      try {
        const payload = { name: name.trim(), description: description.trim() || null }
        if (categoryId) {
          await updateFinanceCategory(categoryId, { ...payload, is_active: isActive })
        } else {
          await createFinanceCategory(payload)
        }
        announceSuccess(editing ? 'Categoria atualizada.' : 'Categoria cadastrada.')
        navigate('/financeiro', { replace: true })
      } catch (requestError) {
        setError(getErrorMessage(requestError, 'Não foi possível salvar a categoria.'))
      }
    })
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <LoadingState message="Carregando categoria..." />
      </main>
    )
  }

  if (editing && error && !name) {
    return (
      <main className="page-wrap">
        <ErrorState message={error} />
      </main>
    )
  }

  return (
    <main className="page-wrap">
      <FormHeader
        module="Financeiro"
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        description="Organize lançamentos por grupos financeiros."
        mode={editing ? 'edit' : 'create'}
        back={{ to: '/financeiro', label: 'Voltar para o Financeiro' }}
        dirty={dirty}
        blocked={saving}
      />
      <SavingForm
        className="page-card max-w-3xl"
        saving={saving}
        onInvalidCapture={() => setError('')}
        onSubmit={handleSubmit}
      >
        <div className="mb-7 flex items-start gap-3 border-b border-line pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-signal">
            <Landmark size={21} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Dados da categoria</h2>
            <p className="mt-1 text-sm text-muted">
              O nome será exibido nos filtros e lançamentos.
            </p>
          </div>
        </div>
        <div className="grid gap-5">
          <label className="form-label">
            <span>
              Nome
              <RequiredMark />
            </span>
            <input
              className="form-input"
              value={name}
              maxLength={120}
              required
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="form-label">
            Descrição
            <textarea
              className="form-input min-h-32 resize-y"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        {editing && (
          <label className="mt-6 flex items-start gap-3 rounded-xl border border-line p-4 text-sm">
            <input
              className="mt-1 h-4 w-4 accent-[#3d63f5]"
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>
              <strong className="block">Categoria ativa</strong>
              <span className="text-xs text-muted">
                Categorias inativas não podem receber novos lançamentos.
              </span>
            </span>
          </label>
        )}
        {error && (
          <p className="mt-6 text-sm text-[#d84f62]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
          <FormExit to="/financeiro" blocked={saving} dirty={dirty}>
            Cancelar
          </FormExit>
          <SaveButton saving={saving} icon={<Save size={17} aria-hidden="true" />}>
            {editing ? 'Salvar alterações' : 'Cadastrar categoria'}
          </SaveButton>
        </div>
      </SavingForm>
    </main>
  )
}
