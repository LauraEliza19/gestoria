import { ArrowLeft, Landmark, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import {
  createFinanceCategory,
  getFinanceCategory,
  updateFinanceCategory,
} from '../../services/finance.service'
import { getErrorMessage } from '../../utils/errors'

export function FinanceCategoryFormPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(categoryId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!categoryId) return
    getFinanceCategory(categoryId)
      .then((category) => {
        setName(category.name)
        setDescription(category.description || '')
        setIsActive(category.is_active)
        setLoading(false)
      })
      .catch((requestError) => {
        setLoading(false)
        setError(getErrorMessage(requestError, 'Não foi possível carregar a categoria.'))
      })
  }, [categoryId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { name: name.trim(), description: description.trim() || null }
      if (categoryId) {
        await updateFinanceCategory(categoryId, { ...payload, is_active: isActive })
      } else {
        await createFinanceCategory(payload)
      }
      navigate('/financeiro', { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Não foi possível salvar a categoria.'))
    } finally {
      setSaving(false)
    }
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
      <header className="page-header">
        <div>
          <Link
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-signal"
            to="/financeiro"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para o Financeiro
          </Link>
          <p className="eyebrow">Controle financeiro</p>
          <h1>{editing ? 'Editar categoria' : 'Cadastrar categoria'}</h1>
          <p>Organize lançamentos por grupos financeiros.</p>
        </div>
      </header>
      <form className="page-card max-w-3xl" onSubmit={handleSubmit}>
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
            Nome
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
          <Link className="secondary-button" to="/financeiro">
            Cancelar
          </Link>
          <button className="primary-button gap-2" type="submit" disabled={saving}>
            <Save size={17} aria-hidden="true" />
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar categoria'}
          </button>
        </div>
      </form>
    </main>
  )
}
