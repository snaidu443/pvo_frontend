import { env } from '../config/env';

/** Error thrown for any non-2xx response. `status` 0 means the network failed. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * The access token is held in memory only (never localStorage), so it is gone
 * on reload and cannot be read by other tabs. Prefer an HttpOnly session cookie
 * from the backend; `credentials: 'include'` below supports that too.
 */
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

let onUnauthorized: (() => void) | null = null;
/** Registered by the app so a 401 signs the user out (fail closed). */
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(env.apiBaseUrl + path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      ...init
    });
  } catch {
    throw new ApiError(0, 'The service could not be reached. Check your connection and try again.');
  }

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Your session has ended. Please sign in again.');
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, 'The service returned an unexpected response.');
    }
  }
  if (!res.ok) {
    // Show the server's message when it sends a FastAPI-style {detail: string}; never echo raw bodies.
    const detail = (data as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : `Request failed (${res.status}).`, detail);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path)
};
