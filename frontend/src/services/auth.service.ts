import { apiFetch } from './api'

export type LoginResponse = {
  access_token: string
}

export type Session = {
  id: string
  full_name: string
  email: string
  role: string
  organization: Record<string, string | null>
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o frontend e o backend estão em execução.')
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