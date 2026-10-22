import { apiFetch } from '@/services/api';

import type {
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
} from '../productTypes';

export function listProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/api/products');
}

export async function getProduct(
  productId: string
): Promise<Product> {
  const products = await listProducts();

  const product = products.find(
    (item) => item.id === productId
  );

  if (!product) {
    throw new Error(
      'Produto não encontrado ou não está mais disponível.'
    );
  }

  return product;
}

export function createProduct(
  payload: ProductCreatePayload
): Promise<Product> {
  return apiFetch<Product>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(
  productId: string,
  payload: ProductUpdatePayload
): Promise<Product> {
  return apiFetch<Product>(
    `/api/products/${productId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export function deleteProduct(
  productId: string
): Promise<void> {
  return apiFetch<void>(
    `/api/products/${productId}`,
    {
      method: 'DELETE',
    }
  );
}