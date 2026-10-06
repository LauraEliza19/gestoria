export type ManagementOverview = {
  total_employees: number
  active_employees: number
  active_cost_centers: number
  active_employments: number
  employees_on_leave: number
}

export type CostCenter = {
  id: string
  organization_id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CostCenterCreatePayload = {
  code: string
  name: string
  description?: string | null
}

export type CostCenterUpdatePayload = Partial<CostCenterCreatePayload> & {
  is_active?: boolean
}

export type EmployeeSummary = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Employee = EmployeeSummary & {
  organization_id: string
  user_id: string | null
  document: string | null
  birth_date: string | null
}

export type EmployeeCreatePayload = {
  user_id?: string | null
  full_name: string
  document?: string | null
  email?: string | null
  phone?: string | null
  birth_date?: string | null
}

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload> & {
  is_active?: boolean
}

export type EmploymentType =
  'employee' | 'contractor' | 'intern' | 'temporary' | 'partner' | 'other'

export type EmploymentStatus = 'active' | 'on_leave' | 'ended'

export type Employment = {
  id: string
  organization_id: string
  employee_id: string
  cost_center_id: string | null
  position_title: string
  employment_type: EmploymentType
  status: EmploymentStatus
  started_at: string
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type EmploymentCompensation = Employment & {
  base_salary: string | null
}

export type EmploymentCreatePayload = {
  cost_center_id?: string | null
  position_title: string
  employment_type?: EmploymentType
  status?: EmploymentStatus
  started_at: string
  ended_at?: string | null
  base_salary?: string | null
  notes?: string | null
}

export type EmploymentUpdatePayload = Partial<EmploymentCreatePayload>
