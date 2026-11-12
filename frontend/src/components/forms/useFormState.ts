import { createContext, useCallback, useContext, useRef, useState } from 'react'

export const FormSuccessContext = createContext<(message: string) => void>(() => {})

export function useFormSuccess() {
  return useContext(FormSuccessContext)
}

export function useSaveAction<Action extends string = never>() {
  const inFlight = useRef(false)
  const [pendingAction, setPendingAction] = useState<Action | 'save' | null>(null)
  const isBusy = () => inFlight.current

  async function run(execute: () => Promise<void>, action: Action | 'save' = 'save') {
    // The lock is set before React renders the disabled button.
    if (inFlight.current) return
    inFlight.current = true
    setPendingAction(action)

    try {
      await execute()
    } finally {
      inFlight.current = false
      setPendingAction(null)
    }
  }

  return { busy: pendingAction !== null, pendingAction, isBusy, run }
}

export function useFormChanges<T>(values: T) {
  const snapshot = JSON.stringify(values)
  const [baseline, setBaseline] = useState(snapshot)
  const resetBaseline = useCallback((next: T) => setBaseline(JSON.stringify(next)), [])

  return { dirty: snapshot !== baseline, resetBaseline }
}
