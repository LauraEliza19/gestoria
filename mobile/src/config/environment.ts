function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? '';
}

const apiUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);

export const environment = {
  apiUrl,
} as const;

export function requireApiUrl() {
  if (!environment.apiUrl) {
    throw new Error(
      'A variável EXPO_PUBLIC_API_URL não foi configurada.'
    );
  }

  return environment.apiUrl;
}