import { useEffect, useRef, useState } from 'react'
import { BookOpen, Boxes, ChefHat, Plus, RefreshCw } from 'lucide-react'
import { apiFetch } from '../../services/api'
import { RecipeForm, StockForm } from './ProductionForms'
import { StockUsageForm } from './StockUsageForm'
import { AvailabilityBoard } from './AvailabilityBoard'
import { friendlyAmount } from './stockUsage'
import { formatQuantity as format } from './productionTypes'
import { getErrorMessage } from '../../utils/errors'
import type { Recipe, Snapshot, StockItem } from './productionTypes'
import { useSession } from '../../contexts/SessionContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'

export type ProductionView = 'ingredients' | 'recipes' | 'available'

type Props = {
  initialView?: ProductionView
  initialQuery?: string
}

export function ProductionPanel({ initialView = 'available', initialQuery = '' }: Props) {
  const { can } = useSession()
  const [view, setView] = useState<ProductionView>(initialView)
  const [data, setData] = useState<Snapshot>({ ingredients: [], stock_items: [], recipes: [] })
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ingredientEditor, setIngredientEditor] = useState<StockItem | null | undefined>()
  const [recipeEditor, setRecipeEditor] = useState<Recipe | null | undefined>()
  const [usingStock, setUsingStock] = useState<string | null>(null)
  const [usageNeedsRefresh, setUsageNeedsRefresh] = useState(false)
  const lock = useRef(true)
  const busy = loading || saving

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<Snapshot>('/api/production', { signal: controller.signal })
      .then((snapshot) => {
        if (!controller.signal.aborted) {
          setData(snapshot)
          setLoaded(true)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(getErrorMessage(reason, 'Não foi possível carregar o estoque e as receitas.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          lock.current = false
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  async function refresh() {
    if (lock.current) return
    lock.current = true
    setLoading(true)
    setError('')
    setNotice('')
    try {
      setData(await apiFetch<Snapshot>('/api/production'))
      setLoaded(true)
      setNotice('Estoque e receitas atualizados.')
      setUsingStock(null)
      setUsageNeedsRefresh(false)
    } catch (reason) {
      setError(getErrorMessage(reason, 'Não foi possível carregar o estoque e as receitas.'))
    } finally {
      lock.current = false
      setLoading(false)
    }
  }

  async function mutate(path: string, method: string, body?: unknown) {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      await apiFetch(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      saved = true
      setIngredientEditor(undefined)
      setRecipeEditor(undefined)
      setData(await apiFetch<Snapshot>('/api/production'))
      setLoaded(true)
      setNotice(
        method === 'DELETE' ? 'Cadastro excluído.' : 'Cadastro salvo. Disponibilidade recalculada.',
      )
    } catch (reason) {
      setError(
        saved
          ? 'Cadastro salvo, mas não foi possível atualizar a consulta. Clique em Atualizar antes de conferir a disponibilidade.'
          : getErrorMessage(reason),
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  async function consume(stock: StockItem, quantity: string) {
    if (lock.current || usageNeedsRefresh) return
    lock.current = true
    setSaving(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      const updated = await apiFetch<StockItem>(`/api/production/stock-items/${stock.id}/consume`, {
        method: 'POST',
        body: JSON.stringify({ quantity, unit: stock.unit, expected_quantity: stock.quantity }),
      })
      saved = true
      setUsingStock(null)
      setData((current) => ({
        ...current,
        stock_items: current.stock_items.map((item) => (item.id === updated.id ? updated : item)),
      }))
      setData(await apiFetch<Snapshot>('/api/production'))
      setNotice(
        `Você usou ${friendlyAmount(quantity, stock.unit)} de ${stock.name}. Estoque e disponibilidade atualizados.`,
      )
    } catch (reason) {
      setUsingStock(null)
      setUsageNeedsRefresh(true)
      setError(
        saved
          ? 'Uso registrado, mas a consulta não foi atualizada. Clique em Atualizar para conferir as receitas.'
          : `${getErrorMessage(reason)} Atualize e confira o saldo antes de registrar outro uso.`,
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  const availableCount = data.recipes.filter((recipe) => recipe.max_batches > 0).length
  const blockedCount = data.recipes.length - availableCount

  return (
    <section aria-label="Painel de produção">
      <div className="metric-grid">
        <article>
          <span>Receitas disponíveis</span>
          <strong className="text-[#28745b]">{loaded ? availableCount : '—'}</strong>
          <small>
            {loaded
              ? `De ${data.recipes.length} ${data.recipes.length === 1 ? 'receita cadastrada' : 'receitas cadastradas'}`
              : 'Com estoque para ao menos uma receita'}
          </small>
        </article>
        <article>
          <span>Receitas bloqueadas</span>
          <strong className={loaded && blockedCount > 0 ? 'text-[#a52c42]' : ''}>
            {loaded ? blockedCount : '—'}
          </strong>
          <small>Falta ao menos um insumo</small>
        </article>
        <article>
          <span>Itens em estoque</span>
          <strong>{loaded ? data.stock_items.length : '—'}</strong>
          <small>Estoque exclusivo da produção</small>
        </article>
      </div>
      <div className="page-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Consultas de produção">
            {(
              [
                { id: 'available', label: 'O que posso preparar', icon: ChefHat },
                { id: 'ingredients', label: 'Estoque', icon: Boxes },
                { id: 'recipes', label: 'Receitas', icon: BookOpen },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={view === id}
                className={`flex items-center gap-2 rounded-lg px-3 py-3 text-[13px] font-bold ${view === id ? 'bg-signal text-white' : 'bg-paper text-muted'}`}
                onClick={() => setView(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="secondary-button gap-2 disabled:opacity-50"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={16}
              className={loading ? 'motion-safe:animate-spin' : ''}
              aria-hidden="true"
            />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {!loaded && loading && <LoadingState message="Calculando o que dá para preparar..." />}
        {!loaded && !loading && error && (
          <ErrorState message={error} onRetry={() => void refresh()} />
        )}

        {loaded && error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-3 text-sm text-[#a52c42]"
          >
            {error}
          </p>
        )}
        {loaded && (
          <p role="status" className="mb-4 text-sm text-muted" aria-live="polite">
            {loading ? 'Atualizando ingredientes e receitas...' : notice}
          </p>
        )}

        {loaded && view === 'available' && (
          <div aria-busy={loading}>
            <AvailabilityBoard
              recipes={data.recipes}
              stockCount={data.stock_items.length}
              initialQuery={initialQuery}
              onOpenRecipes={() => setView('recipes')}
              onOpenStock={() => setView('ingredients')}
            />
          </div>
        )}

        {loaded && view === 'ingredients' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Estoque de ingredientes</h2>
                <p className="mt-1 text-sm text-muted">
                  Cadastre cada item ou marca e escolha a qual ingrediente das receitas ele
                  corresponde.
                </p>
              </div>
              <button
                type="button"
                className="primary-button gap-2"
                disabled={busy || ingredientEditor !== undefined || usingStock !== null}
                onClick={() => setIngredientEditor(null)}
              >
                <Plus size={16} aria-hidden="true" />
                Novo item
              </button>
            </div>
            {ingredientEditor !== undefined && (
              <StockForm
                key={ingredientEditor?.id ?? 'new'}
                stock={ingredientEditor}
                ingredients={data.ingredients}
                busy={busy}
                onCancel={() => setIngredientEditor(undefined)}
                onSave={(body) =>
                  void mutate(
                    `/api/production/stock-items${ingredientEditor ? '/' + ingredientEditor.id : ''}`,
                    ingredientEditor ? 'PUT' : 'POST',
                    body,
                  )
                }
              />
            )}
            <div className="grid gap-3">
              {data.stock_items.map((ingredient) => (
                <article
                  key={ingredient.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{ingredient.name}</h3>
                    <p className="mt-1 font-mono text-sm text-signal-dark">
                      {friendlyAmount(ingredient.quantity, ingredient.unit)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Associado a: {ingredient.ingredient_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        busy ||
                        usageNeedsRefresh ||
                        ingredientEditor !== undefined ||
                        usingStock !== null ||
                        Number(ingredient.quantity) <= 0
                      }
                      aria-label={`Registrar uso de ${ingredient.name}`}
                      onClick={() => setUsingStock(ingredient.id)}
                    >
                      Registrar uso
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || ingredientEditor !== undefined || usingStock !== null}
                      onClick={() => setIngredientEditor(ingredient)}
                    >
                      Editar item
                    </button>
                    {can('production:delete') && (
                      <button
                        type="button"
                        className="secondary-button !text-[#a52c42]"
                        disabled={busy || usingStock !== null}
                        aria-label={`Excluir item ${ingredient.name}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir o item ${ingredient.name} do estoque? As receitas serão mantidas.`,
                            )
                          ) {
                            void mutate(`/api/production/stock-items/${ingredient.id}`, 'DELETE')
                          }
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                  {usingStock === ingredient.id && (
                    <StockUsageForm
                      stock={ingredient}
                      busy={busy}
                      onCancel={() => setUsingStock(null)}
                      onSave={(quantity) => void consume(ingredient, quantity)}
                    />
                  )}
                </article>
              ))}
            </div>
            {data.stock_items.length === 0 && (
              <EmptyState
                title="Nenhum item em estoque"
                description="Você pode cadastrar receitas agora e adicionar os saldos depois. Sem estoque, todas as receitas ficam bloqueadas."
              />
            )}
          </>
        )}

        {loaded && view === 'recipes' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Suas receitas</h2>
                <p className="mt-1 text-sm text-muted">
                  Defina os ingredientes e o rendimento de cada preparação.
                </p>
              </div>
              <button
                type="button"
                className="primary-button gap-2"
                disabled={busy || recipeEditor !== undefined}
                onClick={() => setRecipeEditor(null)}
              >
                <Plus size={16} aria-hidden="true" />
                Nova receita
              </button>
            </div>
            <p className="info-note">
              Suas receitas independem do estoque. Para ligar uma receita aos pedidos, use o mesmo
              nome do produto vendido (maiúsculas e acentos não importam).
            </p>
            {recipeEditor !== undefined && (
              <RecipeForm
                key={recipeEditor?.id ?? 'new'}
                recipe={recipeEditor}
                ingredients={data.ingredients}
                busy={busy}
                onCancel={() => setRecipeEditor(undefined)}
                onSave={(draft) =>
                  void mutate(
                    `/api/production/recipes${recipeEditor ? '/' + recipeEditor.id : ''}`,
                    recipeEditor ? 'PUT' : 'POST',
                    draft,
                  )
                }
              />
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {data.recipes.map((recipe) => (
                <article key={recipe.id} className="min-w-0 rounded-lg border border-line p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="break-words font-display text-xl font-semibold">
                      {recipe.name}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${recipe.max_batches > 0 ? 'bg-[#effbf6] text-[#28745b]' : 'bg-[#fff4f6] text-[#a52c42]'}`}
                    >
                      {recipe.max_batches > 0 ? 'Disponível' : 'Bloqueada'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Uma receita rende {format(recipe.yield_quantity)} {recipe.yield_unit}.
                  </p>
                  <ul className="my-4 divide-y divide-line">
                    {recipe.items.map((item) => (
                      <li key={item.ingredient_id} className="py-3 text-sm">
                        <p className="break-words">
                          <strong>
                            {format(item.quantity)} {item.unit}
                          </strong>{' '}
                          de {item.ingredient_name}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || recipeEditor !== undefined}
                      onClick={() => setRecipeEditor(recipe)}
                    >
                      Editar receita
                    </button>
                    {can('production:delete') && (
                      <button
                        type="button"
                        className="secondary-button !text-[#a52c42]"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Excluir a receita ${recipe.name}?`)) {
                            void mutate(`/api/production/recipes/${recipe.id}`, 'DELETE')
                          }
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {data.recipes.length === 0 && recipeEditor === undefined && (
              <EmptyState
                title="Nenhuma receita cadastrada"
                description="Cadastre a primeira receita, mesmo sem ingredientes em estoque."
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}
