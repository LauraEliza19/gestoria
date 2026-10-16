export const ORDER_STATUSES = [
  'in_preparation',
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
  total_amount: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  in_preparation: 'Em preparo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};