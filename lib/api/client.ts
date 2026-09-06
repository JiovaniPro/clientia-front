const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
}

/**
 * `credentials: "include"` : nécessaire pour /auth/refresh et /auth/logout, qui
 * s'appuient sur le cookie de refresh httpOnly (backend sur un autre port/origine —
 * voir la remarque cross-origin CSRF dans l'historique de conversation). Pas de
 * X-CSRF-Token à fournir : le backend n'exige plus ce header (voir app.ts).
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const errorBody = data as { error?: string; details?: unknown } | undefined;
    throw new ApiError(res.status, errorBody?.error ?? res.statusText, errorBody?.details);
  }

  return data as T;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const apiClient = {
  get: <T>(path: string, accessToken?: string | null, signal?: AbortSignal) =>
    request<T>(path, { accessToken, signal }),
  post: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "POST", body, accessToken }),
  patch: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "PATCH", body, accessToken }),
  put: <T>(path: string, body?: unknown, accessToken?: string | null) =>
    request<T>(path, { method: "PUT", body, accessToken }),
  delete: <T>(path: string, accessToken?: string | null) => request<T>(path, { method: "DELETE", accessToken }),
};
