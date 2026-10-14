import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../services/api'
import { getErrorMessage } from '../../utils/errors'
import type { Recipe, Snapshot } from './productionTypes'

export type SnapshotState = 'idle' | 'loading' | 'error' | 'ready'

/**
 * Carrega o cálculo real de disponibilidade (/api/production) enquanto `active`
 * for verdadeiro. Recarrega sempre que a área volta a ficar ativa, para que a
 * fila de pedidos reflita baixas e cadastros feitos no painel de produção.
 */
export function useProductionSnapshot(active: boolean) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [state, setState] = useState<SnapshotState>('idle')
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setState('loading')
    setError('')
    apiFetch<Snapshot>('/api/production', { signal: controller.signal })
      .then((snapshot) => {
        if (controller.signal.aborted) return
        setRecipes(snapshot.recipes)
        setState('ready')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(getErrorMessage(reason, 'Não foi possível consultar os insumos.'))
        setState('error')
      })
    return () => controller.abort()
  }, [active, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { recipes, state, error, reload }
}
