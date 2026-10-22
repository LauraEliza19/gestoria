export const PRODUCT_CATEGORIES = [
  'padaria',
  'frios',
  'bebidas',
  'outros',
] as const;

export type ProductCategory =
  (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_TYPES = [
  'manufactured',
  'resale',
] as const;

export type ProductType =
  (typeof PRODUCT_TYPES)[number];

export const PRODUCT_UNITS = [
  'unit',
  'kg',
  'g',
] as const;

export type ProductUnit =
  (typeof PRODUCT_UNITS)[number];

export type ProductStatus =
  | 'Disponível'
  | 'Estoque baixo'
  | 'Esgotado'
  | 'Inativo';

export type Product = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  price: string;
  stock_quantity: string;
  is_active: boolean;
  status: ProductStatus;
  category: ProductCategory;
  product_type: ProductType;
  unit_of_measure: ProductUnit;
  cost_price: string | null;
  min_stock_quantity: string;
  perishable: boolean;
  shelf_life_days: number | null;
  barcode: string | null;
  ncm_code: string | null;
  cest_code: string | null;
  fiscal_origin: number | null;
  recipe_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductCreatePayload = {
  name: string;
  description: string | null;
  price: string;
  stock_quantity: string;
  is_active: boolean;
  category: ProductCategory;
  product_type: ProductType;
  unit_of_measure: ProductUnit;
  cost_price: string | null;
  min_stock_quantity: string;
  perishable: boolean;
  shelf_life_days: number | null;
  barcode: string | null;
  ncm_code: string | null;
  cest_code: string | null;
  fiscal_origin: number | null;
  recipe_id: string | null;
};

export type ProductUpdatePayload =
  Partial<ProductCreatePayload>;

export const productCategoryLabels: Record<
  ProductCategory,
  string
> = {
  padaria: 'Padaria',
  frios: 'Frios',
  bebidas: 'Bebidas',
  outros: 'Outros',
};

export const productTypeLabels: Record<
  ProductType,
  string
> = {
  manufactured: 'Fabricação própria',
  resale: 'Revenda',
};

export const productUnitLabels: Record<
  ProductUnit,
  string
> = {
  unit: 'un.',
  kg: 'kg',
  g: 'g',
};