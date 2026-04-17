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
    };

function nextDeliveryStep(
  status: OrderStatusDto,
): { nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"; labelAr: string } | null {
  if (status === "ACCEPTED") {
    return { nextStatus: "PICKED_UP", labelAr: "تم الاستلام من المتجر" };
  }
  if (status === "PICKED_UP") {
    return { nextStatus: "IN_TRANSIT", labelAr: "في الطريق للعميل" };
  }
  if (status === "IN_TRANSIT") {
    return { nextStatus: "DELIVERED", labelAr: "تم تسليم الطلب" };
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
    return {
      mode: "offer",
      orderId: res.order.id,
      order: res.order,
      timeoutSeconds: res.timeoutSeconds,
      expiresAt: res.log.expiresAt,
    };
  }
  if (res.state === "ACTIVE") {
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
    };
  }
  return { mode: "none" };
}

/**
 * من GET طلب واحد — تفاصيل من إشعار / deep link.
 * يعتمد على سجلات التعيين + حالة الطلب.
 */
export function deriveFromOrder(order: OrderDetailDto, captainId: string): CaptainActionResult {
  const pending = order.assignmentLogs?.find(
    (l) => l.captainId === captainId && l.responseStatus === "PENDING",
  );

  if (order.status === "ASSIGNED" && pending) {
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
    };
  }

  return { mode: "none", readOnly: true, order };
}
