// Remove credentials left by versions that used browser storage.
export function clearSession() {
  localStorage.removeItem('gestoria_token')
  sessionStorage.removeItem('gestoria_token')
}

let renewal: Promise<boolean> | null = null
let signingOut = false

export async function renewSession(): Promise<boolean> {
  if (signingOut) return false
  if (!renewal) {
    const renew = async () => {
      // A different tab may already have refreshed while this tab waited.
      const current = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      if (current.ok) return true
      if (current.status !== 401) throw new Error('Não foi possível verificar sua sessão.')
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Protection': '1' },
      })
      if (response.status === 401) return false
      if (!response.ok) throw new Error('Não foi possível renovar sua sessão. Tente novamente.')
      return true
    }
    // Serialize refreshes across tabs as well as within this module.
    renewal = (
      navigator.locks ? navigator.locks.request('gestoria-session', renew) : renew()
    ).finally(() => {
      renewal = null
    })
  }
  return renewal
}

export async function logoutSession() {
  signingOut = true
  try {
    if (renewal) await renewal.catch(() => false)
    const revoke = async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Protection': '1' },
      })
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão. Tente novamente.')
    }
    if (navigator.locks) await navigator.locks.request('gestoria-session', revoke)
    else await revoke()
    clearSession()
    window.location.replace('/login')
  } catch (error) {
    signingOut = false
    throw error
  }
}
