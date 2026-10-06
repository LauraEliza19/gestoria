import { apiFetch } from './api'
import type {
  CostCenter,
  CostCenterCreatePayload,
  CostCenterUpdatePayload,
  Employee,
  EmployeeCreatePayload,
  EmployeeSummary,
  EmployeeUpdatePayload,
  Employment,
  EmployeeRecord,
  EmployeeRecordCancelPayload,
  EmployeeRecordCreatePayload,
  EmployeeRecordFilters,
  EmployeeRecordResolvePayload,
  EmployeeRecordSummary,
  EmployeeRecordUpdatePayload,
  EmploymentCompensation,
  EmploymentCreatePayload,
  EmploymentUpdatePayload,
  ManagementOverview,
} from '../pages/Management/managementTypes'

const MANAGEMENT_URL = '/api/management'

export function getManagementOverview(): Promise<ManagementOverview> {
  return apiFetch<ManagementOverview>(`${MANAGEMENT_URL}/overview`)
}

export function listCostCenters(activeOnly = false): Promise<CostCenter[]> {
  const query = activeOnly ? '?active_only=true' : ''

  return apiFetch<CostCenter[]>(`${MANAGEMENT_URL}/cost-centers${query}`)
}

export function getCostCenter(costCenterId: string): Promise<CostCenter> {
  return apiFetch<CostCenter>(`${MANAGEMENT_URL}/cost-centers/${costCenterId}`)
}

export function createCostCenter(payload: CostCenterCreatePayload): Promise<CostCenter> {
  return apiFetch<CostCenter>(`${MANAGEMENT_URL}/cost-centers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCostCenter(
  costCenterId: string,
  payload: CostCenterUpdatePayload,
): Promise<CostCenter> {
  return apiFetch<CostCenter>(`${MANAGEMENT_URL}/cost-centers/${costCenterId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function listEmployees(activeOnly = false): Promise<EmployeeSummary[]> {
  const query = activeOnly ? '?active_only=true' : ''

  return apiFetch<EmployeeSummary[]>(`${MANAGEMENT_URL}/employees${query}`)
}

export function getEmployee(employeeId: string): Promise<Employee> {
  return apiFetch<Employee>(`${MANAGEMENT_URL}/employees/${employeeId}`)
}

export function createEmployee(payload: EmployeeCreatePayload): Promise<Employee> {
  return apiFetch<Employee>(`${MANAGEMENT_URL}/employees`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEmployee(
  employeeId: string,
  payload: EmployeeUpdatePayload,
): Promise<Employee> {
  return apiFetch<Employee>(`${MANAGEMENT_URL}/employees/${employeeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function listEmployments(employeeId: string): Promise<Employment[]> {
  return apiFetch<Employment[]>(`${MANAGEMENT_URL}/employees/${employeeId}/employments`)
}

export function createEmployment(
  employeeId: string,
  payload: EmploymentCreatePayload,
): Promise<Employment> {
  return apiFetch<Employment>(`${MANAGEMENT_URL}/employees/${employeeId}/employments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEmployment(
  employmentId: string,
  payload: EmploymentUpdatePayload,
): Promise<Employment> {
  return apiFetch<Employment>(`${MANAGEMENT_URL}/employments/${employmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getEmploymentCompensation(employmentId: string): Promise<EmploymentCompensation> {
  return apiFetch<EmploymentCompensation>(
    `${MANAGEMENT_URL}/employments/${employmentId}/compensation`,
  )
}

export function listEmployeeRecords(
  employeeId: string,
  filters: EmployeeRecordFilters = {},
): Promise<EmployeeRecordSummary[]> {
  const parameters = new URLSearchParams()

  if (filters.status) {
    parameters.set('status', filters.status)
  }

  if (filters.record_type) {
    parameters.set('record_type', filters.record_type)
  }

  const query = parameters.toString()

  return apiFetch<EmployeeRecordSummary[]>(
    `${MANAGEMENT_URL}/employees/${employeeId}/records${query ? `?${query}` : ''}`,
  )
}

export function getEmployeeRecord(recordId: string): Promise<EmployeeRecord> {
  return apiFetch<EmployeeRecord>(`${MANAGEMENT_URL}/employee-records/${recordId}`)
}

export function createEmployeeRecord(
  employeeId: string,
  payload: EmployeeRecordCreatePayload,
): Promise<EmployeeRecord> {
  return apiFetch<EmployeeRecord>(`${MANAGEMENT_URL}/employees/${employeeId}/records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEmployeeRecord(
  recordId: string,
  payload: EmployeeRecordUpdatePayload,
): Promise<EmployeeRecord> {
  return apiFetch<EmployeeRecord>(`${MANAGEMENT_URL}/employee-records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function resolveEmployeeRecord(
  recordId: string,
  payload: EmployeeRecordResolvePayload,
): Promise<EmployeeRecord> {
  return apiFetch<EmployeeRecord>(`${MANAGEMENT_URL}/employee-records/${recordId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function cancelEmployeeRecord(
  recordId: string,
  payload: EmployeeRecordCancelPayload,
): Promise<EmployeeRecord> {
  return apiFetch<EmployeeRecord>(`${MANAGEMENT_URL}/employee-records/${recordId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
