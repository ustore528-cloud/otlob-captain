import { ApiClientError } from "@/services/api/errors";
import type { TrackingIssue } from "./types";

function isFetchLikeFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message?: string }).message ?? "");
    if (/network|failed to fetch|internet|timeout/i.test(m)) return true;
  }
  return false;
}

export function classifySendFailure(error: unknown): TrackingIssue {
  if (isFetchLikeFailure(error)) {
    return { kind: "network", message: "لا يوجد اتصال بالخادم أو الشبكة غير مستقرة." };
  }
  if (error instanceof ApiClientError) {
    const retryable = error.status >= 500 || error.status === 408 || error.status === 429;
    return {
      kind: "server",
      message: error.message || "رفض الخادم الطلب.",
      retryable,
    };
  }
  return {
    kind: "server",
    message: error instanceof Error ? error.message : "فشل غير متوقع.",
    retryable: true,
  };
}

export function shouldRetrySend(error: unknown): boolean {
  if (isFetchLikeFailure(error)) return true;
  if (error instanceof ApiClientError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return false;
}
