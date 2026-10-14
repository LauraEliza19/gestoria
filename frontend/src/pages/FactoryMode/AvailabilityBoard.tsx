import { useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, Boxes, CircleCheck, Lock, Search } from 'lucide-react'
import { EmptyState } from '../../components/AsyncState'
import { buildAvailability } from './availability'
import type { ItemAvailability, RecipeAvailability } from './availability'
import { friendlyAmount } from './stockUsage'
import { formatQuantity as format } from './productionTypes'
import type { Recipe } from './productionTypes'

type Filter = 'all' | 'available' | 'blocked'

type Props = {
  recipes: Recipe[]
  stockCount: number
  initialQuery?: string
  onOpenRecipes: () => void
  onOpenStock: () => void
}

function batches(value: number) {
  return `${format(value)} ${value === 1 ? 'receita' : 'receitas'}`
}

function names(items: ItemAvailability[]) {
  return items.map((item) => item.ingredient_name).join(', ')
}

export function AvailabilityBoard({
  recipes,
  stockCount,
  initialQuery = '',
  onOpenRecipes,
  onOpenStock,
}: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const summary = useMemo(() => buildAvailability(recipes, query), [recipes, query])
  const totals = useMemo(() => buildAvailability(recipes), [recipes])
  const searching = query.trim() !== ''
  const showAvailable = filter !== 'blocked'
  const showBlocked = filter !== 'available'
  const nothingFound = summary.available.length + summary.blocked.length === 0

  if (recipes.length === 0) {
    return (
      <div className="grid gap-4">
        <EmptyState
          title="Nenhuma receita cadastrada"
          description="Cadastre uma receita com os ingredientes e o rendimento. O painel calcula na hora quantas você consegue preparar com o estoque atual."
        />
        <button type="button" className="primary-button mx-auto gap-2" onClick={onOpenRecipes}>
          <BookOpen size={16} aria-hidden="true" />
          Cadastrar receita
        </button>
      </div>
    )
  }

  return (
    <section aria-labelledby="availability-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="availability-title" className="font-display text-xl font-semibold">
            O que posso preparar?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Calculado com o saldo real do estoque. Esta consulta não reserva nem desconta
            ingredientes.
          </p>
        </div>
      </div>

      <p className="info-note mt-4">
        Cada receita considera o estoque inteiro, individualmente. Receitas diferentes podem usar os
        mesmos ingredientes, então as quantidades não devem ser somadas.
      </p>

      {stockCount === 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ecd9a7] bg-[#fff9e9] p-3 text-sm text-[#8a6815]">
          <span>Nenhum item em estoque: todas as receitas aparecem como bloqueadas.</span>
          <button type="button" className="secondary-button gap-2" onClick={onOpenStock}>
            <Boxes size={16} aria-hidden="true" />
            Cadastrar estoque
          </button>
        </div>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="form-label" htmlFor="availability-search">
          Buscar receita ou ingrediente
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3.5 text-muted" aria-hidden="true" />
            <input
              id="availability-search"
              type="search"
              className="form-input pl-10"
              placeholder="Ex.: pão, farinha, leite"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar disponibilidade">
          {(
            [
              ['all', 'Todas', totals.available.length + totals.blocked.length],
              ['available', 'Disponíveis', totals.available.length],
              ['blocked', 'Bloqueadas', totals.blocked.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              className={`rounded-lg px-3 py-3 text-[13px] font-bold ${filter === id ? 'bg-signal text-white' : 'bg-paper text-muted hover:text-ink'}`}
              onClick={() => setFilter(id)}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {nothingFound && searching ? (
        <div className="grid gap-3">
          <EmptyState
            title="Nenhuma receita encontrada"
            description="Nenhuma receita ou ingrediente corresponde à busca."
          />
          <button type="button" className="secondary-button mx-auto" onClick={() => setQuery('')}>
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="grid gap-8">
          {showAvailable && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-[#28745b]">
                <CircleCheck size={18} aria-hidden="true" />
                Prontas para produzir ({summary.available.length})
              </h3>
              {summary.available.length === 0 ? (
                <p className="rounded-lg bg-paper p-5 text-sm text-muted">
                  {searching
                    ? 'Nenhuma receita disponível corresponde à busca.'
                    : 'Nenhuma receita tem todos os ingredientes agora. Confira abaixo o que falta repor.'}
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {summary.available.map((entry) => (
                    <AvailableCard key={entry.recipe.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}

          {showBlocked && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-[#a52c42]">
                <Lock size={18} aria-hidden="true" />
                Bloqueadas por falta de insumos ({summary.blocked.length})
              </h3>
              {summary.blocked.length === 0 ? (
                <p className="rounded-lg bg-paper p-5 text-sm text-muted">
                  {searching
                    ? 'Nenhuma receita bloqueada corresponde à busca.'
                    : 'Nenhuma receita bloqueada. Todo o cardápio pode ser preparado ao menos uma vez.'}
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {summary.blocked.map((entry) => (
                    <BlockedCard key={entry.recipe.id} entry={entry} onOpenStock={onOpenStock} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function AvailableCard({ entry }: { entry: RecipeAvailability }) {
  const { recipe } = entry
  return (
    <article
      aria-labelledby={`available-${recipe.id}`}
      className="min-w-0 rounded-lg border border-[#b9e7d5] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4
          id={`available-${recipe.id}`}
          className="min-w-0 break-words font-display text-xl font-semibold"
        >
          {recipe.name}
        </h4>
        <span className="rounded-full bg-[#effbf6] px-3 py-1 text-xs font-semibold text-[#28745b]">
          Disponível
        </span>
      </div>

      <div className="my-4 grid grid-cols-2 gap-3 rounded-lg bg-[#effbf6] p-3">
        <div>
          <p className="text-xs text-[#4f7769]">Pode preparar</p>
          <p className="font-display text-2xl font-semibold text-[#28745b]">
            {batches(recipe.max_batches)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#4f7769]">Rendimento possível</p>
          <p className="font-display text-2xl font-semibold text-[#28745b]">
            {format(recipe.possible_yield)}{' '}
            <span className="text-sm font-medium">{recipe.yield_unit}</span>
          </p>
        </div>
      </div>

      <p className="text-sm text-muted">
        Uma receita rende {format(recipe.yield_quantity)} {recipe.yield_unit}.{' '}
        <span className="text-ink">
          Limitado por: <strong>{names(entry.limiting_items)}</strong>
        </span>
      </p>

      {entry.next_batch_shortfall.length > 0 && (
        <p className="mt-2 text-xs text-[#8a6815]">
          Para mais 1 receita, faltam{' '}
          {entry.next_batch_shortfall
            .map(
              (item) =>
                `${friendlyAmount(item.missing_for_next, item.unit)} de ${item.ingredient_name}`,
            )
            .join(', ')}
          .
        </p>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-signal">
          Ver insumos ({entry.items.length})
        </summary>
        <SupplyList items={entry.items} />
      </details>
    </article>
  )
}

function BlockedCard({
  entry,
  onOpenStock,
}: {
  entry: RecipeAvailability
  onOpenStock: () => void
}) {
  const { recipe } = entry
  const present = entry.items.filter((item) => !entry.missing_items.includes(item))
  return (
    <article
      aria-labelledby={`blocked-${recipe.id}`}
      className="min-w-0 rounded-lg border border-[#f3cbd2] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4
          id={`blocked-${recipe.id}`}
          className="min-w-0 break-words font-display text-xl font-semibold"
        >
          {recipe.name}
        </h4>
        <span className="rounded-full bg-[#fff4f6] px-3 py-1 text-xs font-semibold text-[#a52c42]">
          Bloqueada
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Uma receita rende {format(recipe.yield_quantity)} {recipe.yield_unit}. Falta
        {entry.missing_items.length === 1 ? '' : 'm'} {entry.missing_items.length}{' '}
        {entry.missing_items.length === 1 ? 'insumo' : 'insumos'} para preparar uma receita.
      </p>

      <ul
        className="my-4 divide-y divide-[#f3cbd2] rounded-lg bg-[#fff4f6] px-3"
        aria-label={`Insumos faltantes para ${recipe.name}`}
      >
        {entry.missing_items.map((item) => (
          <li key={item.ingredient_id} className="flex items-start gap-3 py-3 text-sm">
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0 text-[#a52c42]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="break-words font-semibold text-[#a52c42]">
                Faltam {friendlyAmount(item.missing_quantity, item.unit)} de {item.ingredient_name}
              </p>
              <p className="mt-0.5 text-xs text-[#7d4652]">
                Precisa de {friendlyAmount(item.quantity, item.unit)} · em estoque:{' '}
                {friendlyAmount(item.available_quantity, item.unit)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {present.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-signal">
            Insumos já disponíveis ({present.length})
          </summary>
          <SupplyList items={present} />
        </details>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" className="secondary-button gap-2" onClick={onOpenStock}>
          <Boxes size={16} aria-hidden="true" />
          Repor no estoque
        </button>
      </div>
    </article>
  )
}

function SupplyList({ items }: { items: ItemAvailability[] }) {
  return (
    <ul className="mt-2 divide-y divide-line">
      {items.map((item) => (
        <li key={item.ingredient_id} className="py-2.5">
          <p className="break-words">
            <strong>{friendlyAmount(item.quantity, item.unit)}</strong> de {item.ingredient_name}
          </p>
          <p className={`mt-0.5 text-xs ${item.limiting ? 'text-[#8a6815]' : 'text-muted'}`}>
            Em estoque: {friendlyAmount(item.available_quantity, item.unit)} · dá para{' '}
            {batches(item.supported_batches)}
            {item.limiting && item.supported_batches > 0 ? ' · limitante' : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}
