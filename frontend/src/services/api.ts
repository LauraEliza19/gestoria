import { clearSession, getAccessToken } from './session'

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    window.location.replace('/login')
    throw new Error('Faça login para continuar.')
  }
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (response.status === 401) {
    clearSession()
    window.location.replace('/login')
    throw new Error('Sua sessão expirou.')
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail
  if (!response.ok) throw new Error(detail || 'Não foi possível concluir a operação.')
  return body as T
}
