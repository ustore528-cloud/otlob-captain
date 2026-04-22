import type { CurrentAssignmentResponse, OrderDetailDto, OrderStatusDto } from "@/services/api/dto";

export type CaptainActionResult =
  | { mode: "none"; readOnly?: boolean; order?: OrderDetailDto }
  | {
      mode: "offer";
      orderId: string;
      order: OrderDetailDto;
      timeoutSeconds: number;
      expiresAt: string | null;
    }
  | {
      mode: "active_patch";
      orderId: string;
      order: OrderDetailDto;
      nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
      labelAr: string;
      labelEn: string;
    };

function nextDeliveryStep(
  status: OrderStatusDto,
): {
  nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
  labelAr: string;
  /** English primary CTA — aligned with order list */
  labelEn: string;
} | null {
  if (status === "ACCEPTED") {
    return { nextStatus: "PICKED_UP", labelAr: "تم الاستلام من المتجر", labelEn: "Picked Up" };
  }
  if (status === "PICKED_UP") {
    return { nextStatus: "IN_TRANSIT", labelAr: "في الطريق للعميل", labelEn: "On the way" };
  }
  if (status === "IN_TRANSIT") {
    return { nextStatus: "DELIVERED", labelAr: "تم تسليم الطلب", labelEn: "Delivered" };
  }
  return null;
}

/**
 * من `/me/assignment` — المصدر الموثوق للعرض الحالي.
 * @see docs/captain-order-lifecycle.md
 */
export function deriveFromAssignment(res: CurrentAssignmentResponse): CaptainActionResult {
  if (res.state === "NONE") {
    return { mode: "none" };
  }
  if (res.state === "OFFER") {
    if (res.log.expiresAt && new Date(res.log.expiresAt) <= new Date()) {
      return { mode: "none", readOnly: true, order: res.order };
    }
    return {
      mode: "offer",
      orderId: res.order.id,
      order: res.order,
      timeoutSeconds: res.timeoutSeconds,
      expiresAt: res.log.expiresAt,
    };
  }
  if (res.state === "ACTIVE") {
    /** اكتمال التسليم — لا يُعرض كطلب «حي» في شاشة العمليات (ينتقل للأرشيف). */
    if (res.order.status === "DELIVERED") {
      /** Keep `order` + readOnly so workbench does not fall through to `AssignmentEmptyState` while DTO/API are briefly inconsistent. */
      return { mode: "none", readOnly: true, order: res.order };
    }
    const step = nextDeliveryStep(res.order.status);
    if (!step) {
      return { mode: "none", readOnly: true, order: res.order };
    }
    return {
      mode: "active_patch",
      orderId: res.order.id,
      order: res.order,
      nextStatus: step.nextStatus,
      labelAr: step.labelAr,
      labelEn: step.labelEn,
    };
  }
  return { mode: "none" };
}

/**
 * من GET طلب واحد — تفاصيل من إشعار / deep link.
 * يعتمد على سجلات التعيين + حالة الطلب.
 */
function isPendingOfferStillValid(expiredAt: string | null): boolean {
  if (!expiredAt) return true;
  return new Date(expiredAt).getTime() > Date.now();
}

export function deriveFromOrder(order: OrderDetailDto, captainId: string): CaptainActionResult {
  const logs = order.assignmentLogs ?? [];
  const pending = logs.find((l) => l.captainId === captainId && l.responseStatus === "PENDING");

  const isActiveAssignee = order.assignedCaptainId != null && order.assignedCaptainId === captainId;

  if (
    order.status === "ASSIGNED" &&
    pending &&
    isActiveAssignee &&
    isPendingOfferStillValid(pending.expiredAt ?? null)
  ) {
    return {
      mode: "offer",
      orderId: order.id,
      order,
      timeoutSeconds: 0,
      expiresAt: pending.expiredAt,
    };
  }

  const acceptedByThisCaptain = order.assignmentLogs?.some(
    (l) => l.captainId === captainId && l.responseStatus === "ACCEPTED",
  );

  const step = nextDeliveryStep(order.status);
  if (step && acceptedByThisCaptain) {
    return {
      mode: "active_patch",
      orderId: order.id,
      order,
      nextStatus: step.nextStatus,
      labelAr: step.labelAr,
      labelEn: step.labelEn,
    };
  }

  return { mode: "none", readOnly: true, order };
}
