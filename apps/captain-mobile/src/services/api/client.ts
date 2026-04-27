import { paths } from "@captain/shared";
import i18n from "@/i18n/i18n";
import { env } from "@/utils/env";
import { ApiClientError } from "./errors";
import { getTokenBridge } from "./token-bridge";
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from "./types";

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function unwrapData<T>(json: unknown): T {
  if (
    json &&
    typeof json === "object" &&
    "success" in json &&
    (json as { success: boolean }).success === true &&
    "data" in json
  ) {
    return (json as ApiSuccessEnvelope<T>).data;
  }
  throw new ApiClientError(i18n.t("apiClient.badEnvelope"), 500, "BAD_ENVELOPE");
}

function throwFromErrorBody(status: number, json: unknown): never {
  const body = json as ApiErrorEnvelope | null;
  if (body && body.success === false && body.error) {
    throw new ApiClientError(body.error.message, status, body.error.code, body.error.details);
  }
  throw new ApiClientError(i18n.t("apiClient.requestFailed"), status);
}

/**
 * Unauthenticated JSON request — login, refresh, health.
 */
function mergeHeaders(init: RequestInit): HeadersInit {
  const base: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.body != null && base["Content-Type"] === undefined) {
    base["Content-Type"] = "application/json";
  }
  return base;
}

export async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${env.apiUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: mergeHeaders(init),
  });
  const text = await res.text();
  const json = parseJson(text);

  if (!res.ok) {
    throwFromErrorBody(res.status, json);
  }

  return unwrapData<T>(json);
}

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const bridge = getTokenBridge();
  if (!bridge) return false;
  const refresh = bridge.getRefresh();
  if (!refresh) return false;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const data = await rawRequest<{
        accessToken: string;
        refreshToken: string;
      }>(paths.mobileCaptain.refresh, {
        method: "POST",
        body: JSON.stringify({ refreshToken: refresh }),
      });
      await Promise.resolve(bridge.setTokens(data.accessToken, data.refreshToken));
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export type AuthRequestOptions = RequestInit & {
  /** Skip Authorization header (rare). */
  skipAuth?: boolean;
};

export type AuthRequestMeta<T> = {
  data: T;
  status: number;
  url: string;
  responseBody: unknown;
};

/**
 * Authenticated request with optional single 401 → refresh → retry.
 */
export async function authRequest<T>(path: string, init: AuthRequestOptions = {}): Promise<T> {
  const { skipAuth, ...rest } = init;
  const bridge = getTokenBridge();
  if (!bridge && !skipAuth) {
    throw new ApiClientError(i18n.t("apiClient.noTokenBridge"), 503, "NO_TOKEN_BRIDGE");
  }

  const run = async (token: string | null) => {
    const h = mergeHeaders(rest);
    const headers = h as Record<string, string>;
    if (!skipAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const url = `${env.apiUrl}${path}`;
    const res = await fetch(url, {
      ...rest,
      headers,
    });
    const text = await res.text();
    const json = parseJson(text);

    if (!res.ok) {
      throwFromErrorBody(res.status, json);
    }

    return unwrapData<T>(json);
  };

  const token = skipAuth ? null : bridge?.getAccess() ?? null;
  if (!skipAuth && !token) {
    throw new ApiClientError(i18n.t("apiClient.noAccessToken"), 401, "NO_ACCESS_TOKEN");
  }

  try {
    return await run(token);
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 401 && !skipAuth) {
      const refreshed = await performRefresh();
      if (!refreshed) throw e;
      const next = getTokenBridge()?.getAccess() ?? null;
      if (!next) throw e;
      return await run(next);
    }
    throw e;
  }
}

export async function authRequestWithMeta<T>(path: string, init: AuthRequestOptions = {}): Promise<AuthRequestMeta<T>> {
  const { skipAuth, ...rest } = init;
  const bridge = getTokenBridge();
  if (!bridge && !skipAuth) {
    throw new ApiClientError(i18n.t("apiClient.noTokenBridge"), 503, "NO_TOKEN_BRIDGE");
  }

  const run = async (token: string | null): Promise<AuthRequestMeta<T>> => {
    const h = mergeHeaders(rest);
    const headers = h as Record<string, string>;
    if (!skipAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const url = `${env.apiUrl}${path}`;
    const res = await fetch(url, {
      ...rest,
      headers,
    });
    const text = await res.text();
    const json = parseJson(text);

    if (!res.ok) {
      throwFromErrorBody(res.status, json);
    }

    return {
      data: unwrapData<T>(json),
      status: res.status,
      url,
      responseBody: json,
    };
  };

  const token = skipAuth ? null : bridge?.getAccess() ?? null;
  if (!skipAuth && !token) {
    throw new ApiClientError(i18n.t("apiClient.noAccessToken"), 401, "NO_ACCESS_TOKEN");
  }

  try {
    return await run(token);
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 401 && !skipAuth) {
      const refreshed = await performRefresh();
      if (!refreshed) throw e;
      const next = getTokenBridge()?.getAccess() ?? null;
      if (!next) throw e;
      return await run(next);
    }
    throw e;
  }
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
