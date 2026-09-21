import { useEffect, useRef, useState } from 'react'
import { BookOpen, Boxes, ChefHat, Plus, RefreshCw } from 'lucide-react'
import { apiFetch } from '../../services/api'
import { RecipeForm, StockForm } from './ProductionForms'
import { formatQuantity as format } from './productionTypes'
import type { Recipe, Snapshot, StockItem } from './productionTypes'

type View = 'ingredients' | 'recipes' | 'available'
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'

export function ProductionPanel() {
  const [view, setView] = useState<View>('available')
  const [data, setData] = useState<Snapshot>({ ingredients: [], stock_items: [], recipes: [] })
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ingredientEditor, setIngredientEditor] = useState<StockItem | null | undefined>()
  const [recipeEditor, setRecipeEditor] = useState<Recipe | null | undefined>()
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const lock = useRef(true)
  const busy = loading || saving

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<Snapshot>('/api/production', { signal: controller.signal })
      .then(snapshot => { if (!controller.signal.aborted) { setData(snapshot); setLoaded(true) } })
      .catch(reason => { if (!controller.signal.aborted) setError(message(reason)) })
      .finally(() => { if (!controller.signal.aborted) { lock.current = false; setLoading(false) } })
    return () => controller.abort()
  }, [])

  async function refresh() {
    if (lock.current) return
    lock.current = true
    setLoading(true); setError(''); setNotice('')
    try {
      setData(await apiFetch<Snapshot>('/api/production'))
      setLoaded(true)
      setNotice('Estoque e receitas atualizados.')
    } catch (reason) { setError(message(reason)) }
    finally { lock.current = false; setLoading(false) }
  }

  async function mutate(path: string, method: string, body?: unknown) {
    if (lock.current) return
    lock.current = true
    setSaving(true); setError(''); setNotice('')
    let saved = false
    try {
      await apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      saved = true
      setIngredientEditor(undefined); setRecipeEditor(undefined)
      setData(await apiFetch<Snapshot>('/api/production'))
      setLoaded(true)
      setNotice(method === 'DELETE' ? 'Cadastro excluído.' : 'Cadastro salvo. Disponibilidade recalculada.')
    } catch (reason) {
      setError(saved ? 'Cadastro salvo, mas não foi possível atualizar a consulta. Clique em Atualizar antes de conferir a disponibilidade.' : message(reason))
    } finally { lock.current = false; setSaving(false) }
  }

  const availableCount = data.recipes.filter(recipe => recipe.max_batches > 0).length
  const shownRecipes = view === 'available' && onlyAvailable ? data.recipes.filter(recipe => recipe.max_batches > 0) : data.recipes
  return <section aria-label="Painel de produção">
    <div className="metric-grid">
      <article><span>Itens em estoque</span><strong>{loaded ? data.stock_items.length : '—'}</strong><small>Estoque exclusivo da produção</small></article>
      <article><span>Receitas cadastradas</span><strong>{loaded ? data.recipes.length : '—'}</strong><small>Ingredientes e rendimento definidos</small></article>
      <article><span>Receitas disponíveis</span><strong>{loaded ? availableCount : '—'}</strong><small>Com estoque para ao menos uma receita</small></article>
    </div>
    <div className="page-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Consultas de produção">
          {([{ id: 'available', label: 'O que posso preparar', icon: ChefHat }, { id: 'ingredients', label: 'Estoque', icon: Boxes }, { id: 'recipes', label: 'Receitas', icon: BookOpen }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={view === id} className={`flex items-center gap-2 rounded-lg px-3 py-3 text-[13px] font-bold ${view === id ? 'bg-signal text-white' : 'bg-paper text-muted'}`} onClick={() => setView(id)}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        <button type="button" className="secondary-button gap-2 disabled:opacity-50" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} className={loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-[#f3cbd2] bg-[#fff4f6] p-3 text-sm text-[#a52c42]">{error}</p>}
      <p role="status" className="mb-4 text-sm text-muted">{loading ? 'Consultando ingredientes e receitas...' : notice}</p>
      {loaded && view === 'ingredients' && <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">Estoque de ingredientes</h2><p className="mt-1 text-sm text-muted">Cadastre cada item ou marca e escolha a qual ingrediente das receitas ele corresponde.</p></div><button type="button" className="primary-button gap-2" disabled={busy || ingredientEditor !== undefined} onClick={() => setIngredientEditor(null)}><Plus size={16} aria-hidden="true" />Novo item</button></div>
        {ingredientEditor !== undefined && <StockForm key={ingredientEditor?.id ?? 'new'} stock={ingredientEditor} ingredients={data.ingredients} busy={busy} onCancel={() => setIngredientEditor(undefined)} onSave={body => void mutate(`/api/production/stock-items${ingredientEditor ? '/' + ingredientEditor.id : ''}`, ingredientEditor ? 'PUT' : 'POST', body)} />}
        <div className="grid gap-3">{data.stock_items.map(ingredient => <article key={ingredient.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"><div className="min-w-0"><h3 className="break-words font-semibold">{ingredient.name}</h3><p className="mt-1 font-mono text-sm text-signal-dark">{format(ingredient.quantity)} {ingredient.unit}</p><p className="mt-1 text-xs text-muted">Associado a: {ingredient.ingredient_name}</p></div><div className="flex gap-2"><button type="button" className="secondary-button" disabled={busy || ingredientEditor !== undefined} onClick={() => setIngredientEditor(ingredient)}>Editar item</button><button type="button" className="secondary-button !text-[#a52c42]" disabled={busy} aria-label={`Excluir item ${ingredient.name}`} onClick={() => { if (window.confirm(`Excluir o item ${ingredient.name} do estoque? As receitas serão mantidas.`)) void mutate('/api/production/stock-items/' + ingredient.id, 'DELETE') }}>Excluir</button></div></article>)}</div>
        {data.stock_items.length === 0 && <p className="rounded-lg bg-paper p-6 text-sm text-muted">Nenhum item em estoque. Você pode cadastrar receitas agora e adicionar os saldos depois.</p>}
      </>}
      {loaded && view === 'recipes' && <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">Suas receitas</h2><p className="mt-1 text-sm text-muted">Defina os ingredientes e o rendimento de cada preparação.</p></div><button type="button" className="primary-button gap-2" disabled={busy || recipeEditor !== undefined} onClick={() => setRecipeEditor(null)}><Plus size={16} aria-hidden="true" />Nova receita</button></div>
        <p className="info-note">Suas receitas independem do estoque. Ingredientes sem saldo aparecem como faltantes na consulta.</p>
        {recipeEditor !== undefined && <RecipeForm key={recipeEditor?.id ?? 'new'} recipe={recipeEditor} ingredients={data.ingredients} busy={busy} onCancel={() => setRecipeEditor(undefined)} onSave={draft => void mutate(`/api/production/recipes${recipeEditor ? '/' + recipeEditor.id : ''}`, recipeEditor ? 'PUT' : 'POST', draft)} />}
      </>}
      {loaded && view === 'available' && <>
        <h2 className="font-display text-xl font-semibold">O que posso preparar?</h2>
        <p className="mt-2 text-sm text-muted">Cada opção considera o estoque inteiro, individualmente. As quantidades de receitas diferentes não devem ser somadas, pois podem usar os mesmos ingredientes.</p>
        <p className="mt-2 text-sm text-muted">Esta consulta não reserva nem desconta ingredientes.</p>
        <label className="my-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} />Mostrar apenas receitas disponíveis</label>
      </>}
      {loaded && view !== 'ingredients' && <div className="grid gap-4 lg:grid-cols-2">
        {shownRecipes.map(recipe => <article key={recipe.id} className="min-w-0 rounded-lg border border-line p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words font-display text-xl font-semibold">{recipe.name}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${recipe.max_batches > 0 ? 'bg-[#effbf6] text-[#28745b]' : 'bg-[#fff4f6] text-[#a52c42]'}`}>{recipe.max_batches > 0 ? 'Disponível' : 'Faltam ingredientes'}</span></div>
          <p className="mt-2 text-sm text-muted">Uma receita rende {format(recipe.yield_quantity)} {recipe.yield_unit}.</p>
          {view === 'available' && <div className="my-4 rounded-lg bg-paper p-3"><p className="font-semibold">{format(recipe.max_batches)} receita(s) completa(s)</p><p className="mt-1 text-sm text-muted">Rendimento possível: {format(recipe.possible_yield)} {recipe.yield_unit}</p></div>}
          <ul className="my-4 divide-y divide-line">{recipe.items.map(item => <li key={item.ingredient_id} className="py-3 text-sm"><p className="break-words"><strong>{format(item.quantity)} {item.unit}</strong> de {item.ingredient_name}</p>{view === 'available' && <p className={`mt-1 text-xs ${Number(item.missing_quantity) > 0 ? 'text-[#a52c42]' : 'text-muted'}`}>Disponível: {format(item.available_quantity)} {item.unit}{Number(item.missing_quantity) > 0 && ` · Faltam ${format(item.missing_quantity)} ${item.unit} para uma receita`}</p>}</li>)}</ul>
          {view === 'recipes' && <div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" disabled={busy || recipeEditor !== undefined} onClick={() => setRecipeEditor(recipe)}>Editar receita</button><button type="button" className="secondary-button !text-[#a52c42]" disabled={busy} onClick={() => { if (window.confirm(`Excluir a receita ${recipe.name}?`)) void mutate('/api/production/recipes/' + recipe.id, 'DELETE') }}>Excluir</button></div>}
        </article>)}
        {shownRecipes.length === 0 && <div className="rounded-lg bg-paper p-6 text-sm text-muted lg:col-span-2">{data.recipes.length === 0 ? 'Nenhuma receita cadastrada. Abra Receitas e cadastre a primeira, mesmo sem ingredientes em estoque.' : 'Nenhuma receita tem todos os ingredientes necessários. Desmarque o filtro para conferir o que falta.'}</div>}
      </div>}
    </div>
  </section>
}
