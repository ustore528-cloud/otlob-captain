import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import i18n from "@/i18n/i18n";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

/** Dev-only bridge so `use-dashboard-socket-invalidate` can log socket vs mutation invalidate order. */
declare global {
  interface Window {
    __OTLOB_LAST_ASSIGN?: { orderId: string; invalidateCompletedAt: number };
  }
}

export type AssignOrderMode = "manual" | "drag-drop";

export type AssignOrderToCaptainVariables = {
  orderId: string;
  captainId: string;
  mode: AssignOrderMode;
  clickAtMs?: number;
  source?: string;
};

export function useAssignOrderToCaptain() {
  const qc = useQueryClient();
  const timingRef = useRef<{
    clickAtMs?: number;
    mutateCalledAt: number;
    requestStartedAt?: number;
    responseReceivedAt?: number;
    source?: string;
  } | null>(null);
  return useMutation({
    onMutate: (v) => {
      const now = performance.now();
      timingRef.current = {
        clickAtMs: v.clickAtMs,
        mutateCalledAt: now,
        source: v.source,
      };
      // eslint-disable-next-line no-console
      console.info("[otlob:assign-timing] mutation started", {
        mode: v.mode,
        orderId: v.orderId,
        source: v.source ?? "unknown",
        clickToMutateStartMs: v.clickAtMs != null ? now - v.clickAtMs : undefined,
      });
    },
    mutationFn: async ({ orderId, captainId, mode }: AssignOrderToCaptainVariables) => {
      const apiStart = performance.now();
      if (timingRef.current) {
        timingRef.current.requestStartedAt = apiStart;
      }
      const result =
        mode === "drag-drop"
          ? await api.orders.distributionDragDrop(orderId, captainId)
          : await api.orders.distributionManual(orderId, captainId);
      const apiEnd = performance.now();
      if (timingRef.current) {
        timingRef.current.responseReceivedAt = apiEnd;
      }
      const t = timingRef.current;
      // eslint-disable-next-line no-console
      console.info("[otlob:assign-timing] API block finished", {
        mode,
        orderId,
        source: t?.source ?? "unknown",
        apiHttpMs: apiEnd - apiStart,
        mutateToApiResolvedMs: t?.mutateCalledAt != null ? apiEnd - t.mutateCalledAt : undefined,
        clickToResponseMs: t?.clickAtMs != null ? apiEnd - t.clickAtMs : undefined,
      });
      return result;
    },
    onSuccess: (_, v) => {
      const successAt = performance.now();
      toastSuccess(
        String(
          i18n.t(v.mode === "drag-drop" ? "mutationToasts.assignDragDrop" : "mutationToasts.assignManual"),
        ),
      );
      const t = timingRef.current;
      // eslint-disable-next-line no-console
      console.info("[otlob:assign-timing] success UI fired", {
        mode: v.mode,
        orderId: v.orderId,
        source: t?.source ?? "unknown",
        clickToSuccessToastMs: t?.clickAtMs != null ? successAt - t.clickAtMs : undefined,
      });

      const invStart = performance.now();
      void invalidateOrderDistributionDomain(qc).then(() => {
        const invEnd = performance.now();
        if (typeof window !== "undefined") {
          window.__OTLOB_LAST_ASSIGN = { orderId: v.orderId, invalidateCompletedAt: invEnd };
        }
        // eslint-disable-next-line no-console
        console.info("[otlob:assign-timing] background invalidate finished", {
          mode: v.mode,
          orderId: v.orderId,
          source: t?.source ?? "unknown",
          invalidateOrderDomainMs: invEnd - invStart,
          clickToInvalidateDoneMs: t?.clickAtMs != null ? invEnd - t.clickAtMs : undefined,
        });
      });

      requestAnimationFrame(() => {
        const uiUpdatedAt = performance.now();
        // eslint-disable-next-line no-console
        console.info("[otlob:assign-timing] next frame painted", {
          mode: v.mode,
          orderId: v.orderId,
          source: t?.source ?? "unknown",
          clickToUiPaintMs: t?.clickAtMs != null ? uiUpdatedAt - t.clickAtMs : undefined,
          responseToUiPaintMs: t?.responseReceivedAt != null ? uiUpdatedAt - t.responseReceivedAt : undefined,
        });
      });

      timingRef.current = null;
    },
    onError: (e, v) => {
      const failAt = performance.now();
      const t = timingRef.current;
      // eslint-disable-next-line no-console
      console.info("[otlob:assign-timing] mutation failed", {
        mode: v.mode,
        orderId: v.orderId,
        source: t?.source ?? "unknown",
        clickToErrorMs: t?.clickAtMs != null ? failAt - t.clickAtMs : undefined,
      });
      timingRef.current = null;
      toastApiError(e, String(i18n.t("mutationToasts.assignCaptainFailed")));
    },
  });
}
