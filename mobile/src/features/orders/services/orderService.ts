import { apiFetchItems } from '@/services/api';

import type { Order } from '../orderTypes';

export function listOrders(): Promise<Order[]> {
  return apiFetchItems<Order>('/api/orders');
}