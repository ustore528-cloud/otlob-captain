import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import i18n from "@/i18n/i18n";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type ResendToDistributionVariables =
  | string
  | {
      orderId: string;
      clickAtMs?: number;
      source?: string;
    };

export function useResendOrderToDistribution() {
  const qc = useQueryClient();
  const timingRef = useRef<{
    orderId: string;
    clickAtMs?: number;
    mutateCalledAt: number;
    source?: string;
  } | null>(null);

  const toPayload = (v: ResendToDistributionVariables): { orderId: string; clickAtMs?: number; source?: string } =>
    typeof v === "string" ? { orderId: v } : v;

  return useMutation({
    onMutate: (v) => {
      const payload = toPayload(v);
      const now = performance.now();
      timingRef.current = {
        orderId: payload.orderId,
        clickAtMs: payload.clickAtMs,
        mutateCalledAt: now,
        source: payload.source,
      };
      // eslint-disable-next-line no-console
      console.info("[otlob:resend-timing] mutation started", {
        orderId: payload.orderId,
        source: payload.source ?? "unknown",
        clickToMutateStartMs: payload.clickAtMs != null ? now - payload.clickAtMs : undefined,
      });
    },
    mutationFn: async (v: ResendToDistributionVariables) => {
      const payload = toPayload(v);
      const start = performance.now();
      const out = await api.orders.distributionResend(payload.orderId);
      const end = performance.now();
      const t = timingRef.current;
      // eslint-disable-next-line no-console
      console.info("[otlob:resend-timing] API block finished", {
        orderId: payload.orderId,
        source: t?.source ?? payload.source ?? "unknown",
        apiHttpMs: end - start,
        clickToResponseMs: t?.clickAtMs != null ? end - t.clickAtMs : undefined,
      });
      return out;
    },
    onSuccess: (_, v) => {
      const payload = toPayload(v);
      const successAt = performance.now();
      const t = timingRef.current;
      toastSuccess(String(i18n.t("mutationToasts.redistributeSuccess")));
      // eslint-disable-next-line no-console
      console.info("[otlob:resend-timing] success UI fired", {
        orderId: payload.orderId,
        source: t?.source ?? payload.source ?? "unknown",
        clickToSuccessToastMs: t?.clickAtMs != null ? successAt - t.clickAtMs : undefined,
      });

      const invStart = performance.now();
      void invalidateOrderDistributionDomain(qc).then(() => {
        const invEnd = performance.now();
        // eslint-disable-next-line no-console
        console.info("[otlob:resend-timing] background invalidate finished", {
          orderId: payload.orderId,
          source: t?.source ?? payload.source ?? "unknown",
          invalidateOrderDomainMs: invEnd - invStart,
          clickToInvalidateDoneMs: t?.clickAtMs != null ? invEnd - t.clickAtMs : undefined,
        });
      });

      requestAnimationFrame(() => {
        const uiUpdatedAt = performance.now();
        // eslint-disable-next-line no-console
        console.info("[otlob:resend-timing] next frame painted", {
          orderId: payload.orderId,
          source: t?.source ?? payload.source ?? "unknown",
          clickToUiPaintMs: t?.clickAtMs != null ? uiUpdatedAt - t.clickAtMs : undefined,
        });
      });
      timingRef.current = null;
    },
    onError: (e, v) => {
      const payload = toPayload(v);
      const now = performance.now();
      const t = timingRef.current;
      // eslint-disable-next-line no-console
      console.info("[otlob:resend-timing] mutation failed", {
        orderId: payload.orderId,
        source: t?.source ?? payload.source ?? "unknown",
        clickToErrorMs: t?.clickAtMs != null ? now - t.clickAtMs : undefined,
      });
      timingRef.current = null;
      toastApiError(e, String(i18n.t("mutationToasts.redistributeFailed")));
    },
  });
}
