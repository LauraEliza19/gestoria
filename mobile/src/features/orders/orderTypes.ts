export const ORDER_STATUSES = [
  'in_preparation',
  'in_production',
  'ready',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
};

export type Order = {
  id: string;
  organization_id: string;
  customer_id: string;
  customer_name: string;
  status: OrderStatus;
  promised_at: string | null;
  priority: 'normal' | 'high' | 'urgent';
  notes: string | null;
  total_amount: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  in_preparation: 'Confirmado',
  in_production: 'Em produção',
  ready: 'Pronto',
  completed: 'Entregue',
  cancelled: 'Cancelado',
};
