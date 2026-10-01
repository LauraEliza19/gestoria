import { apiFetch } from './api'

import type { UserRole } from '../utils/permissions'

export type LoginResponse = {
  access_expires_at: string
  expires_at: string
}

export type Session = {
  id: string
  full_name: string
  email: string
  role: UserRole
  organization: Record<string, string | null>
}

export async function login(
  email: string,
  password: string,
  remember = false,
): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
      body: JSON.stringify({ email, password, remember }),
    })
  } catch {
    throw new Error(
      'Não foi possível conectar à API. Verifique se o frontend e o backend estão em execução.',
    )
  }

  const body = await response.json().catch(() => ({}))
  const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail

  if (!response.ok) {
    throw new Error(detail || 'Não foi possível entrar.')
  }

  return body as LoginResponse
}

export async function getSession() {
  return apiFetch<Session>('/api/auth/me')
}
