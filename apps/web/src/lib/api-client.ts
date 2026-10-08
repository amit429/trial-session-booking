import { ERROR_MESSAGES, type ErrorCode, type ExistingTrialDto, type SuggestionsResponse } from "@shared";

type QueryParams = Record<string, string | number | undefined>;
type ErrorDetails = { fieldErrors?: Record<string, string>; suggestions?: SuggestionsResponse } & Partial<ExistingTrialDto>;

/** An API error in the shared envelope { error: { code, message, details } }. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | "NETWORK",
    message: string,
    public readonly details: ErrorDetails = {}
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
/** The user-facing message for any thrown value. */
export const errorMessage = (e: unknown) => (isApiError(e) ? e.message : ERROR_MESSAGES.INTERNAL);

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
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code?: ErrorCode; message?: string; details?: ErrorDetails } }).error ?? {};
    throw new ApiError(res.status, e.code ?? "INTERNAL", e.message ?? ERROR_MESSAGES.INTERNAL, e.details ?? {});
  }
  return data as T;
}

const toQuery = (params?: QueryParams) => {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** Thin typed client for the same-origin /api (cookies included). */
export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>("GET", `${path}${toQuery(params)}`),
  post: <T>(path: string, body: unknown = {}, headers?: Record<string, string>) => request<T>("POST", path, body, headers)
};

/** Turn absolute app URLs from the API (e.g. manageUrl) into in-app paths. */
export const appPath = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};
