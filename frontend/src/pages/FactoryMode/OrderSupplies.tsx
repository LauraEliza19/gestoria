import { useId, useState } from 'react'
import { ChevronDown, ChevronUp, PackageSearch } from 'lucide-react'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { toScaled } from './availability'
import type { OrderSupply, OrderSupplyStatus } from './availability'
import { friendlyAmount } from './stockUsage'
import { formatQuantity as format } from './productionTypes'
import type { SnapshotState } from './useProductionSnapshot'

const badges: Record<OrderSupplyStatus, { label: string; className: string }> = {
  ready: { label: 'Insumos suficientes', className: 'bg-[#effbf6] text-[#28745b]' },
  short: { label: 'Faltam insumos', className: 'bg-[#fff4f6] text-[#a52c42]' },
  partial: { label: 'Cobertura parcial', className: 'bg-[#fff9e9] text-[#8a6815]' },
  unlinked: { label: 'Sem receita vinculada', className: 'bg-paper text-muted' },
}

type Props = {
  orderLabel: string
  supply: OrderSupply | null
  state: SnapshotState
  error: string
  onRetry: () => void
  onOpenAvailability: (recipeName: string) => void
}

export function OrderSupplyBadge({ supply, state }: Pick<Props, 'supply' | 'state'>) {
  if (!supply) {
    return (
      <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-muted">
        {state === 'error' ? 'Insumos indisponíveis' : 'Calculando insumos...'}
      </span>
    )
  }
  const badge = badges[supply.status]
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  )
}

export function OrderSupplies({
  orderLabel,
  supply,
  state,
  error,
  onRetry,
  onOpenAvailability,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const firstRecipe = supply?.lines.find((line) => line.recipe)?.recipe

  return (
    <div className="mb-4">
      <button
        type="button"
        className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-bold text-signal"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <PackageSearch size={16} aria-hidden="true" />
        {open ? 'Ocultar insumos' : 'Consultar insumos'}
        {open ? (
          <ChevronUp size={15} aria-hidden="true" />
        ) : (
          <ChevronDown size={15} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="mt-3 grid gap-4 rounded-lg border border-line p-4"
          aria-label={`Insumos do ${orderLabel}`}
          role="region"
        >
          {!supply && state === 'error' && <ErrorState message={error} onRetry={onRetry} />}
          {!supply && state !== 'error' && <LoadingState message="Calculando insumos..." />}

          {supply && (
            <>
              <ul className="grid gap-2" aria-label="Receitas dos itens">
                {supply.lines.map((line, index) => (
                  <li
                    key={`${line.product_name}-${index}`}
                    className="flex flex-wrap items-start justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      <strong>{format(line.quantity)}×</strong> {line.product_name}
                    </span>
                    <span
                      className={`text-xs ${
                        line.covered === false
                          ? 'text-[#a52c42]'
                          : line.covered
                            ? 'text-[#28745b]'
                            : 'text-muted'
                      }`}
                    >
                      {!line.recipe
                        ? 'Nenhuma receita com este nome'
                        : line.batches_needed === null
                          ? `Rende em ${line.recipe.yield_unit}: dá para ${format(line.recipe.max_batches)} receita(s), confira a quantidade`
                          : `Precisa de ${format(line.batches_needed)} receita(s) · dá para ${format(line.recipe.max_batches)}`}
                    </span>
                  </li>
                ))}
              </ul>

              {supply.needs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-left text-sm">
                    <caption className="mb-2 text-left text-xs font-bold uppercase text-[#8991aa]">
                      Insumos necessários para o pedido
                    </caption>
                    <thead>
                      <tr className="text-xs text-muted">
                        <th className="py-2 pr-3 font-semibold">Insumo</th>
                        <th className="py-2 pr-3 font-semibold">Precisa</th>
                        <th className="py-2 pr-3 font-semibold">Em estoque</th>
                        <th className="py-2 font-semibold">Falta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {supply.needs.map((need) => {
                        const missing = toScaled(need.missing) > 0n
                        return (
                          <tr key={need.ingredient_id} className={missing ? 'text-[#a52c42]' : ''}>
                            <td className="py-2 pr-3 font-semibold">{need.ingredient_name}</td>
                            <td className="py-2 pr-3">
                              {friendlyAmount(need.required, need.unit)}
                            </td>
                            <td className="py-2 pr-3">
                              {friendlyAmount(need.available, need.unit)}
                            </td>
                            <td className="py-2">
                              {missing ? friendlyAmount(need.missing, need.unit) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {supply.status === 'unlinked'
                    ? 'Cadastre uma receita com o mesmo nome do produto para calcular os insumos deste pedido.'
                    : 'Não foi possível somar os insumos: o rendimento da receita não está em unidades.'}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  Saldo atual do estoque. Pedidos diferentes não reservam insumos entre si.
                </p>
                {firstRecipe && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onOpenAvailability(firstRecipe.name)}
                  >
                    Ver no painel de disponibilidade
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
