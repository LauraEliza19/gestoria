import { apiFetch } from '@/services/api';

import type { DashboardOverview } from '../dashboardTypes';

export function getDashboardOverview(): Promise<DashboardOverview> {
  return apiFetch<DashboardOverview>('/api/dashboard/overview');
}