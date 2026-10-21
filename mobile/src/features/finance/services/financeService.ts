import { apiFetch } from '@/services/api';

import type {
  FinanceCategory,
  FinanceCategoryCreatePayload,
  FinanceData,
  FinanceEntry,
  FinanceEntryCreatePayload,
  FinanceEntryFilters,
  FinanceSummary,
} from '../financeTypes';

function buildQuery(filters: FinanceEntryFilters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getFinanceSummary(
  filters: Omit<FinanceEntryFilters, 'status'> = {}
) {
  return apiFetch<FinanceSummary>(
    `/api/finance/summary${buildQuery(filters)}`
  );
}

export function getFinanceEntries(
  filters: FinanceEntryFilters = {}
) {
  return apiFetch<FinanceEntry[]>(
    `/api/finance/entries${buildQuery(filters)}`
  );
}

export function getFinanceCategories() {
  return apiFetch<FinanceCategory[]>(
    '/api/finance/categories'
  );
}

export function createFinanceCategory(
  payload: FinanceCategoryCreatePayload
) {
  return apiFetch<FinanceCategory>('/api/finance/categories', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function createFinanceEntry(
  payload: FinanceEntryCreatePayload
) {
  return apiFetch<FinanceEntry>('/api/finance/entries', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export async function getFinanceData(
  filters: FinanceEntryFilters = {}
): Promise<FinanceData> {
  const { status: _status, ...summaryFilters } = filters;

  const [summary, entries, categories] = await Promise.all([
    getFinanceSummary(summaryFilters),
    getFinanceEntries(filters),
    getFinanceCategories(),
  ]);

  return { summary, entries, categories };
}
