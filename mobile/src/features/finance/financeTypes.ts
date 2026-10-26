export const FINANCE_ENTRY_TYPES = [
  'income',
  'expense',
] as const;

export type FinanceEntryType =
  (typeof FINANCE_ENTRY_TYPES)[number];

export const FINANCE_ENTRY_STATUSES = [
  'pending',
  'paid',
  'cancelled',
] as const;

export type FinanceEntryStatus =
  (typeof FINANCE_ENTRY_STATUSES)[number];

export type FinanceCategory = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinanceEntry = {
  id: string;
  organization_id: string;
  category_id: string;
  description: string;
  amount: string;
  entry_type: FinanceEntryType;
  status: FinanceEntryStatus;
  transaction_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceSummary = {
  total_income: string;
  total_expense: string;
  balance: string;
  realized_status: 'paid';
};

export type FinanceEntryFilters = {
  start_date?: string;
  end_date?: string;
  entry_type?: FinanceEntryType;
  status?: FinanceEntryStatus;
  category_id?: string;
};

export type FinanceData = {
  summary: FinanceSummary;
  entries: FinanceEntry[];
  categories: FinanceCategory[];
};

export type FinanceEntryCreatePayload = {
  category_id: string;
  description: string;
  amount: string;
  entry_type: FinanceEntryType;
  status: FinanceEntryStatus;
  transaction_date: string;
  notes: string | null;
};

export type FinanceCategoryCreatePayload = {
  name: string;
  description: string | null;
};
