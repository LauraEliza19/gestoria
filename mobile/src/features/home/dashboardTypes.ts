export const DASHBOARD_HEALTH_VALUES = [
  'healthy',
  'attention',
  'critical',
] as const;

export type DashboardHealth =
  (typeof DASHBOARD_HEALTH_VALUES)[number];

export const DASHBOARD_ALERT_SEVERITIES = [
  'info',
  'warning',
  'critical',
] as const;

export type DashboardAlertSeverity =
  (typeof DASHBOARD_ALERT_SEVERITIES)[number];

export const DASHBOARD_MODULES = [
  'orders',
  'quotes',
  'products',
  'production',
  'fiscal',
  'management',
  'financial',
] as const;

export type DashboardModule =
  (typeof DASHBOARD_MODULES)[number];

export type DashboardSummary = {
  sales_today: string;
  orders_in_preparation: number;
  blocked_recipes: number;
  critical_stock_items: number;
  fiscal_attention: number;
  active_employees: number | null;
  open_employee_records: number | null;
  financial_balance: string | null;
  financial_available: boolean;
  management_available: boolean;
};

export type DashboardAlert = {
  id: string;
  module: DashboardModule;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  impact: string;
  occurred_at: string | null;
  source: string;
  action_label: string;
  action_route: string;
  count: number;
};

export type DashboardOverview = {
  generated_at: string;
  health: DashboardHealth;
  summary: DashboardSummary;
  alerts: DashboardAlert[];
};