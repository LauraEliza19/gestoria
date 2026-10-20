import { useState } from 'react'
import { Search } from 'lucide-react'
import { filterRecipes, recipeOutlook } from './availability'
import type { RecipeFilter, RecipeOutlook } from './availability'
import { friendlyAmount } from './stockUsage'
import { formatQuantity as format } from './productionTypes'
import type { Recipe } from './productionTypes'

const filters: { id: RecipeFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'ready', label: 'Prontas' },
  { id: 'blocked', label: 'Bloqueadas' },
]

function ReadyCard({ outlook }: { outlook: RecipeOutlook }) {
  const { recipe } = outlook
  return (
    <article className="min-w-0 rounded-lg border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="break-words font-display text-xl font-semibold">{recipe.name}</h4>
        <span className="rounded-full bg-[#effbf6] px-3 py-1 text-xs font-semibold text-[#28745b]">
          Pronta
        </span>
      </div>
      <div className="my-4 rounded-lg bg-paper p-3">
        <p className="font-semibold">
          Dá para fazer {format(recipe.max_batches)}{' '}
          {recipe.max_batches === 1 ? 'receita completa' : 'receitas completas'}
        </p>
        <p className="mt-1 text-sm text-muted">
          Rendimento possível: {format(recipe.possible_yield)} {recipe.yield_unit} (
          {format(recipe.yield_quantity)} por receita)
        </p>
      </div>
      {outlook.limiting.length > 0 && (
        <p className="text-sm">
          <span className="text-muted">
            {outlook.limiting.length === 1 ? 'Ingrediente limitante:' : 'Ingredientes limitantes:'}
          </span>{' '}
          {outlook.limiting.join(', ')}
        </p>
      )}
      {outlook.next_batch.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="text-muted">Para mais uma receita, faltam:</p>
          <ul className="mt-1 grid gap-1">
            {outlook.next_batch.map((item) => (
              <li key={item.ingredient_id} className="break-words">
                <strong className="font-mono">{friendlyAmount(item.missing, item.unit)}</strong> de{' '}
                {item.ingredient_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function BlockedCard({ outlook }: { outlook: RecipeOutlook }) {
  const { recipe } = outlook
  return (
    <article className="min-w-0 rounded-lg border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="break-words font-display text-xl font-semibold">{recipe.name}</h4>
        <span className="rounded-full bg-[#fff4f6] px-3 py-1 text-xs font-semibold text-[#a52c42]">
          Bloqueada
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {outlook.next_batch.length === 1
          ? 'Falta 1 insumo para uma receita'
          : `Faltam ${outlook.next_batch.length} insumos para uma receita`}{' '}
        de {format(recipe.yield_quantity)} {recipe.yield_unit}.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-sm">
          <caption className="sr-only">Insumos que faltam para {recipe.name}</caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Insumo
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Precisa
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Em estoque
              </th>
              <th scope="col" className="py-2 font-semibold">
                Falta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {outlook.next_batch.map((item) => (
              <tr key={item.ingredient_id}>
                <th scope="row" className="py-2 pr-3 font-medium">
                  {item.ingredient_name}
                </th>
                <td className="py-2 pr-3 font-mono">{friendlyAmount(item.per_batch, item.unit)}</td>
                <td className="py-2 pr-3 font-mono">{friendlyAmount(item.available, item.unit)}</td>
                <td className="py-2 font-mono font-semibold text-[#a52c42]">
                  {friendlyAmount(item.missing, item.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function AvailabilityBoard({
  recipes,
  onOpenRecipes,
}: {
  recipes: Recipe[]
  onOpenRecipes: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RecipeFilter>('all')
  const outlooks = filterRecipes(recipes, query, filter).map(recipeOutlook)
  const ready = outlooks.filter((outlook) => outlook.ready)
  const blocked = outlooks.filter((outlook) => !outlook.ready)

  return (
    <>
      <h2 className="font-display text-xl font-semibold">O que posso preparar?</h2>
      <p className="mt-2 text-sm text-muted">
        Cada receita é calculada sozinha sobre todo o estoque. Não some as quantidades de receitas
        diferentes: elas podem disputar os mesmos ingredientes. Para conferir os pedidos na ordem da
        fila, use Consultar insumos na Fila de pedidos.
      </p>
      <p className="mt-2 text-sm text-muted">
        Esta consulta não reserva nem desconta ingredientes.
      </p>

      {recipes.length === 0 ? (
        <div className="mt-5 rounded-lg bg-paper p-6 text-sm text-muted">
          <p>Nenhuma receita cadastrada. Cadastre a primeira, mesmo sem ingredientes em estoque.</p>
          <button type="button" className="secondary-button mt-4" onClick={onOpenRecipes}>
            Abrir receitas
          </button>
        </div>
      ) : (
        <>
          <div className="my-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="form-label" htmlFor="availability-search">
              Buscar receita ou ingrediente
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-3.5 text-muted"
                  aria-hidden="true"
                />
                <input
                  id="availability-search"
                  type="search"
                  className="form-input pl-10"
                  placeholder="Ex.: pão de queijo ou farinha"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Situação das receitas">
              {filters.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={filter === id}
                  className={`rounded-lg px-4 py-3 text-[13px] font-bold ${filter === id ? 'bg-signal text-white' : 'bg-paper text-muted'}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {outlooks.length === 0 && (
            <div className="rounded-lg bg-paper p-6 text-sm text-muted">
              <p>
                {query
                  ? 'Nenhuma receita ou ingrediente corresponde à busca.'
                  : filter === 'ready'
                    ? 'Nenhuma receita tem todos os ingredientes para uma receita completa.'
                    : 'Todas as receitas têm ingredientes para ao menos uma receita completa.'}
              </p>
              <button
                type="button"
                className="secondary-button mt-4"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}

          {ready.length > 0 && (
            <section aria-labelledby="ready-recipes" className="mb-6">
              <h3 id="ready-recipes" className="mb-3 font-semibold">
                Prontas para produzir ({ready.length})
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {ready.map((outlook) => (
                  <ReadyCard key={outlook.recipe.id} outlook={outlook} />
                ))}
              </div>
            </section>
          )}

          {blocked.length > 0 && (
            <section aria-labelledby="blocked-recipes">
              <h3 id="blocked-recipes" className="mb-3 font-semibold">
                Bloqueadas por falta de insumos ({blocked.length})
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {blocked.map((outlook) => (
                  <BlockedCard key={outlook.recipe.id} outlook={outlook} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
