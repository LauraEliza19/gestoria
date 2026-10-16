import { apiFetch } from '@/services/api';

import type { Order } from '../orderTypes';

export function listOrders(): Promise<Order[]> {
  return apiFetch<Order[]>('/api/orders');
}