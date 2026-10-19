import { apiFetch } from '@/services/api';

import type {
  LoginCredentials,
  LoginResponse,
  Session,
} from '@/features/auth/authTypes';

export function login({
  email,
  password,
  remember = false,
}: LoginCredentials) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      remember,
    }),
    retryOnUnauthorized: false,
  });
}

export function getSession() {
  return apiFetch<Session>('/api/auth/me');
}

export function logout() {
  return apiFetch<null>('/api/auth/logout', {
    method: 'POST',
    retryOnUnauthorized: false,
  });
}

export function logoutAllSessions() {
  return apiFetch<null>('/api/auth/logout-all', {
    method: 'POST',
  });
}