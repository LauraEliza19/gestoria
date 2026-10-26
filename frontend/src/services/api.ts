import { clearSession, renewSession } from './session'

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  headers.set('X-CSRF-Protection', '1')
  const send = () =>
    fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' })
  let response = await send()
  if (response.status === 401 && (await renewSession())) response = await send()
  if (response.status === 401) {
    clearSession()
    window.location.replace('/login')
    throw new Error('Sua sessão expirou.')
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail
  const message =
    typeof detail === 'object' && detail !== null
      ? (detail as { message?: string }).message || 'Não foi possível concluir a operação.'
      : detail
  if (!response.ok)
    throw new ApiError(message || 'Não foi possível concluir a operação.', response.status, detail)
  return body as T
}
