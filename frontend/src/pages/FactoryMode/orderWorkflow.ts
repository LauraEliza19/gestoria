import type { Order } from './productionTypes'

export type OperationalOrderStatus = 'in_preparation' | 'in_production' | 'ready'

export function isOperationalOrderStatus(
  status: Order['status'],
): status is OperationalOrderStatus {
  return status === 'in_preparation' || status === 'in_production' || status === 'ready'
}

export function nextOperationalStatus(status: Order['status']): Order['status'] | null {
  switch (status) {
    case 'in_preparation':
      return 'in_production'
    case 'in_production':
      return 'ready'
    case 'ready':
      return 'completed'
    default:
      return null
  }
}

export function operationalActionLabel(status: Order['status']): string | null {
  switch (status) {
    case 'in_preparation':
      return 'Iniciar produção'
    case 'in_production':
      return 'Marcar como pronto'
    case 'ready':
      return 'Marcar como entregue'
    default:
      return null
  }
}
