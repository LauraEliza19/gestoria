import { requireApiUrl } from '@/config/environment';

type ApiFetchOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

type ErrorDetail = {
  msg?: string;
};

type ErrorBody = {
  detail?: string | ErrorDetail[];
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${requireApiUrl()}${normalizedPath}`;
}

function buildHeaders(options: RequestInit) {
  const headers = new Headers(options.headers);

  headers.set('X-CSRF-Protection', '1');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

async function send(path: string, options: RequestInit = {}) {
  try {
    return await fetch(buildUrl(path), {
      ...options,
      headers: buildHeaders(options),
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar à API do GestorIA.',
      0
    );
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  return response.json().catch(() => null);
}

function readErrorMessage(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const detail = (body as ErrorBody).detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail[0]?.msg;
  }

  return undefined;
}

let renewal: Promise<boolean> | null = null;

async function renewSession() {
  if (!renewal) {
    renewal = (async () => {
      const response = await send('/api/auth/refresh', {
        method: 'POST',
      });

      if (response.status === 401) {
        return false;
      }

      if (!response.ok) {
        const body = await readBody(response);

        throw new ApiError(
          readErrorMessage(body) ??
            'Não foi possível renovar sua sessão.',
          response.status
        );
      }

      return true;
    })().finally(() => {
      renewal = null;
    });
  }

  return renewal;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    retryOnUnauthorized = true,
    ...requestOptions
  } = options;

  let response = await send(path, requestOptions);

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    (await renewSession())
  ) {
    response = await send(path, requestOptions);
  }

  if (response.status === 401 && retryOnUnauthorized) {
    throw new ApiError('Sua sessão expirou.', 401);
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw new ApiError(
      readErrorMessage(body) ??
        'Não foi possível concluir a operação.',
      response.status
    );
  }

  return body as T;
}