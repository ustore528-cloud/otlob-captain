import { paths } from "@captain/shared";

const BASE = import.meta.env.VITE_API_URL ?? "";
let unauthorizedHandler: (() => void) | null = null;

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFail = { success: false; error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * طبقة HTTP خام — يمكن استخدامها لتسجيل الدخول دون `ApiClient`.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const text = await res.text();
  const json = parseJson(text);

  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const body = json as ApiFail | null;
    if (body && body.success === false && body.error) {
      throw new ApiError(body.error.message, res.status, body.error.code, body.error.details);
    }
    const legacy = json as { error?: string; code?: string; details?: unknown } | null;
    throw new ApiError(legacy?.error ?? "Request failed", res.status, legacy?.code, legacy?.details);
  }

  const okBody = json as ApiSuccess<T> | null;
  if (okBody && typeof okBody === "object" && "success" in okBody && okBody.success === true) {
    return okBody.data;
  }

  return json as T;
}

export { paths };
export const apiBaseUrl = BASE;
