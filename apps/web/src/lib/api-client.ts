import { ERROR_MESSAGES, type ErrorCode } from "@shared";

export class ApiError extends Error {
  constructor(public status: number, public code: ErrorCode | "NETWORK", message: string, public details?: any) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, "NETWORK", "We couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "INTERNAL", e.message ?? ERROR_MESSAGES.INTERNAL, e.details);
  }
  return data as T;
}

const qs = (params?: Record<string, string | number | undefined>) => {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => request<T>("GET", `${path}${qs(params)}`),
  post: <T>(path: string, body: unknown = {}, headers?: Record<string, string>) => request<T>("POST", path, body, headers)
};

/** Turn "/booking/CY-1?token=…" style absolute URLs from the API into in-app paths. */
export const appPath = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};
