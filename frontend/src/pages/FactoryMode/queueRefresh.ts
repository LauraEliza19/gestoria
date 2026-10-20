export type QueueRefresh<Orders, Supplies> = {
  orders?: Orders
  supplies?: Supplies
  notice: string
  error: string
}

/**
 * Loads the queue and the production snapshot in parallel and only reports
 * success after both requests have finished.
 */
export async function loadQueueAndSupplies<Orders, Supplies>(
  loadOrders: () => Promise<Orders>,
  loadSupplies: () => Promise<Supplies>,
  describe: (reason: unknown, fallback: string) => string,
): Promise<QueueRefresh<Orders, Supplies>> {
  const [orders, supplies] = await Promise.allSettled([
    Promise.resolve().then(loadOrders),
    Promise.resolve().then(loadSupplies),
  ])
  const result: QueueRefresh<Orders, Supplies> = { notice: '', error: '' }
  if (orders.status === 'fulfilled') result.orders = orders.value
  if (supplies.status === 'fulfilled') result.supplies = supplies.value

  if (orders.status === 'fulfilled' && supplies.status === 'fulfilled') {
    result.notice = 'Fila e insumos atualizados.'
  } else if (orders.status === 'fulfilled' && supplies.status === 'rejected') {
    result.error = `Fila atualizada, mas os insumos não foram carregados. ${describe(supplies.reason, 'Tente novamente.')}`
  } else if (orders.status === 'rejected' && supplies.status === 'fulfilled') {
    result.error = `Insumos atualizados, mas a fila não foi carregada. ${describe(orders.reason, 'Tente novamente.')}`
  } else if (orders.status === 'rejected') {
    result.error = `Não foi possível carregar a fila nem os insumos. ${describe(orders.reason, 'Tente novamente.')}`
  }
  return result
}
