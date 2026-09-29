import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getSession } from '../services/auth.service'
import type { Session } from '../services/auth.service'
import { getErrorMessage } from '../utils/errors'
import { hasPermission } from '../utils/permissions'
import type { Permission } from '../utils/permissions'

type SessionContextValue = {
  session: Session
  can: (permission: Permission) => boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

type SessionProviderProps = {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    setError('')

    getSession()
      .then((currentSession) => {
        if (!cancelled) {
          setSession(currentSession)
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(requestError, 'Não foi possível carregar os dados da sua sessão.'),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6">
        <section
          className="w-full max-w-md rounded-xl border border-line bg-white p-6 text-center"
          aria-labelledby="session-error-title"
        >
          <h1 className="font-display text-2xl font-semibold" id="session-error-title">
            Não foi possível abrir o GestorIA
          </h1>

          <p className="mt-3 text-sm text-muted" role="alert">
            {error}
          </p>

          <button
            className="primary-button mt-5"
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-paper p-6"
        aria-busy="true"
        aria-label="Carregando sessão"
      >
        <p className="text-sm text-muted" role="status">
          Carregando seu ambiente...
        </p>
      </main>
    )
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        can: (permission) => hasPermission(session.role, permission),
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession deve ser utilizado dentro de SessionProvider.')
  }

  return context
}
