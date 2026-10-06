import { useCallback, useEffect, useState } from 'react'
import {
  getManagementOverview,
  listCostCenters,
  listEmployees,
} from '../../services/management.service'
import { getErrorMessage } from '../../utils/errors'
import type { CostCenter, EmployeeSummary, ManagementOverview } from './managementTypes'

type ManagementState = {
  overview: ManagementOverview | null
  employees: EmployeeSummary[]
  costCenters: CostCenter[]
  loading: boolean
  error: string
}

const initialState: ManagementState = {
  overview: null,
  employees: [],
  costCenters: [],
  loading: true,
  error: '',
}

export function useManagement() {
  const [state, setState] = useState<ManagementState>(initialState)
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([getManagementOverview(), listEmployees(), listCostCenters()])
      .then(([overview, employees, costCenters]) => {
        if (cancelled) return

        setState({
          overview,
          employees,
          costCenters,
          loading: false,
          error: '',
        })
      })
      .catch((requestError) => {
        if (cancelled) return

        setState((current) => ({
          ...current,
          loading: false,
          error: getErrorMessage(requestError, 'Não foi possível carregar a Gestão Interna.'),
        }))
      })

    return () => {
      cancelled = true
    }
  }, [requestVersion])

  const reload = useCallback(() => {
    setState((current) => ({
      ...current,
      loading: true,
      error: '',
    }))
    setRequestVersion((current) => current + 1)
  }, [])

  return {
    ...state,
    reload,
  }
}
