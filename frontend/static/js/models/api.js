import { clearSession, getAccessToken } from "./session.js";

export async function apiFetch(path, options = {}) {
  const token = getAccessToken();
  if (!token) {
    window.location.replace("/");
    throw new Error("Faça login para continuar.");
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    clearSession();
    window.location.replace("/");
    throw new Error("Sua sessão expirou.");
  }

  const body = response.status === 204 ? null : await response.json();
  const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail;
  if (!response.ok) {
    throw new Error(detail || "Não foi possível concluir a operação.");
  }
  return body;
}
