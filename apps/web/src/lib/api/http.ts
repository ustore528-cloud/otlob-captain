import { paths } from "@captain/shared";

let unauthorizedHandler: (() => void) | null = null;

/**
 * `VITE_API_BASE_URL` must be the server **origin** only (e.g. `https://api.example.com`, empty for same-origin + Vite proxy).
 * `VITE_API_URL` remains supported as a legacy fallback.
 * If someone sets `…/api` or `…/api/v1`, requests would become `/api/api/v1/...` and return **404**.
 */
export function resolveApiBase(): string {
  let base = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "").trim();
  if (!base) return "";
  base = base.replace(/\/+$/, "");
  if (/\/api\/v1$/i.test(base)) {
    return base.replace(/\/api\/v1$/i, "");
  }
  if (/\/api$/i.test(base)) {
    return base.replace(/\/api$/i, "");
  }
  return base;
}

export const apiBaseUrl = resolveApiBase();

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

function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).length;
}

function shouldTraceDistributionTiming(path: string): boolean {
  return (
    path.includes("/distribution/manual") ||
    path.includes("/distribution/drag-drop") ||
    path.includes("/distribution/resend")
  );
}

/** HTTP header — مطابق لطلب `requireIdempotencyKeyHeader` في الـ API. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

/**
 * طبقة HTTP خام — يمكن استخدامها لتسجيل الدخول دون `ApiClient`.
 * يدعم `idempotencyKey` لعناوين مثل `POST` للتمويل.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null; idempotencyKey?: string } = {},
): Promise<T> {
  const { token, idempotencyKey, headers, ...rest } = init;
  const requestBodyText = typeof rest.body === "string" ? rest.body : "";
  const trace = shouldTraceDistributionTiming(path);
  const t0 = trace ? performance.now() : 0;

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
      ...(idempotencyKey && idempotencyKey.trim() !== "" ? { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey.trim() } : {}),
    },
  });
  const headersAt = trace ? performance.now() : 0;
  const text = await res.text();
  const bodyAt = trace ? performance.now() : 0;
  const json = parseJson(text);

  if (trace) {
    // eslint-disable-next-line no-console
    console.info("[otlob:http-timing]", {
      method: rest.method ?? "GET",
      path,
      requestSentAtMs: t0,
      ttfbMs: headersAt - t0,
      totalDurationMs: bodyAt - t0,
      requestPayloadBytes: requestBodyText ? utf8ByteLength(requestBodyText) : 0,
      responsePayloadBytes: text ? utf8ByteLength(text) : 0,
      contentLengthHeader: res.headers.get("content-length"),
      status: res.status,
    });
  }

  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const body = json as ApiFail | null;
    if (body && body.success === false && body.error) {
      throw new ApiError(body.error.message, res.status, body.error.code, body.error.details);
    }
    const legacy = json as { error?: string; code?: string; details?: unknown } | null;
    let fallback = legacy?.error ?? "Request failed";
    if (res.status === 404 && path.includes("/geocode/")) {
      fallback =
        "لم يُعثر على مسار تحديد الموقع (404). تأكد أن عنوان الـ API في الإعدادات هو أصل الموقع فقط (بدون /api)، وأن الخادم منشور بنسخة تتضمن /api/v1/geocode/place.";
    }
    throw new ApiError(fallback, res.status, legacy?.code, legacy?.details);
  }

  const okBody = json as ApiSuccess<T> | null;
  if (okBody && typeof okBody === "object" && "success" in okBody && okBody.success === true) {
    return okBody.data;
  }

  return json as T;
}

export { paths };
