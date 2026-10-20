import { supplyLabels } from './availability'
import type { OrderSupplies as Plan, SupplyStatus } from './availability'
import { friendlyAmount } from './stockUsage'
import { formatQuantity as format } from './productionTypes'

const badgeStyles: Record<SupplyStatus, string> = {
  sufficient: 'bg-[#effbf6] text-[#28745b]',
  short: 'bg-[#fff4f6] text-[#a52c42]',
  partial: 'bg-[#fff8e6] text-[#8a5a00]',
  unlinked: 'bg-paper text-muted',
}

export function SupplyBadge({ status }: { status: SupplyStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status]}`}>
      {supplyLabels[status]}
    </span>
  )
}

function batches(value: number) {
  return value < 0.01
    ? 'menos de 0,01 receita'
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${value > 1 ? 'receitas' : 'receita'}`
}

export function OrderSupplies({ plan, id }: { plan: Plan; id: string }) {
  return (
    <section
      id={id}
      aria-label="Insumos do pedido"
      className="mb-4 rounded-lg border border-line p-4"
    >
      <ul className="mb-4 grid gap-2 text-sm">
        {plan.items.map((item, index) => (
          <li key={`${item.product_name}-${index}`} className="break-words">
            <strong>
              {format(item.quantity)}× {item.product_name}
            </strong>
            {item.batches !== undefined ? (
              <span className="text-muted">
                {' '}
                · {batches(item.batches)} de {item.recipe_name}
              </span>
            ) : (
              <span className="text-[#8a5a00]"> · {item.reason}</span>
            )}
          </li>
        ))}
      </ul>

      {plan.lines.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-sm">
            <caption className="sr-only">Insumos necessários para o pedido</caption>
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Insumo
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Precisa
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Disponível
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Falta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plan.lines.map((line) => (
                <tr key={line.ingredient_id}>
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {line.ingredient_name}
                  </th>
                  <td className="py-2 pr-3 font-mono">{friendlyAmount(line.needed, line.unit)}</td>
                  <td className="py-2 pr-3">
                    <span className="font-mono">{friendlyAmount(line.available, line.unit)}</span>
                    {line.reserved_before > 0 && (
                      <small className="block text-xs text-muted">
                        de {friendlyAmount(line.in_stock, line.unit)};{' '}
                        {friendlyAmount(line.reserved_before, line.unit)} reservado para pedidos
                        anteriores
                      </small>
                    )}
                  </td>
                  <td
                    className={`py-2 font-mono ${line.missing > 0 ? 'font-semibold text-[#a52c42]' : 'text-muted'}`}
                  >
                    {line.missing > 0 ? friendlyAmount(line.missing, line.unit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-paper p-3 text-sm text-muted">
          Nenhum insumo calculado. Vincule uma receita ao produto no cadastro de produtos.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Posição {plan.position} na fila. Pedidos mais antigos reservam os insumos primeiro; a
        reserva é só uma simulação e não desconta o estoque.
      </p>
    </section>
  )
}
