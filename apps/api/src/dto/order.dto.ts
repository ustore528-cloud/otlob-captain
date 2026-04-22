import type { OrderStatus, AssignmentResponseStatus, AssignmentType } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { inferOrderFinancialBreakdown, type OrderFinancialBreakdownDto } from "@captain/shared";

function dec(v: Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

export type StoreSummaryDto = { id: string; name: string; area: string; phone?: string };

export type OrderAssignmentLogDto = {
  id: string;
  captainId: string;
  assignmentType: AssignmentType;
  assignedAt: string;
  responseStatus: AssignmentResponseStatus;
  expiredAt: string | null;
  notes: string | null;
};

export type OrderDetailDto = {
  id: string;
  orderNumber: string;
  /** الكابتن المعيّن حاليًا على الطلب — يُستخدم للتمييز بين عرض قديم وبيانات الطلب الحالية */
  assignedCaptainId: string | null;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  /**
   * Single server-side snapshot of captain-facing money lines (aligned with mobile).
   * Until explicit DB columns exist, `deliveryFee` is **inferred** — see `@captain/shared` `inferOrderFinancialBreakdown`.
   */
  financialBreakdown: OrderFinancialBreakdownDto;
  notes: string | null;
  store: StoreSummaryDto;
  createdAt: string;
  updatedAt: string;
  assignmentLogs: OrderAssignmentLogDto[];
};

export type OrderListItemDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  store: Pick<StoreSummaryDto, "id" | "name" | "area">;
  createdAt: string;
  updatedAt: string;
};

type OrderWithStore = {
  id: string;
  orderNumber: string;
  assignedCaptainId: string | null;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: Decimal;
  cashCollection: Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  store: { id: string; name: string; area: string; phone?: string };
  assignmentLogs?: Array<{
    id: string;
    captainId: string;
    assignmentType: AssignmentType;
    assignedAt: Date;
    responseStatus: AssignmentResponseStatus;
    expiredAt: Date | null;
    notes: string | null;
  }>;
};

export function toOrderDetailDto(order: OrderWithStore): OrderDetailDto {
  const amountStr = dec(order.amount);
  const cashStr = dec(order.cashCollection);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    assignedCaptainId: order.assignedCaptainId,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    area: order.area,
    amount: amountStr,
    cashCollection: cashStr,
    financialBreakdown: inferOrderFinancialBreakdown(amountStr, cashStr),
    notes: order.notes,
    store: {
      id: order.store.id,
      name: order.store.name,
      area: order.store.area,
      ...(order.store.phone != null ? { phone: order.store.phone } : {}),
    },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    assignmentLogs: (order.assignmentLogs ?? []).map((l) => ({
      id: l.id,
      captainId: l.captainId,
      assignmentType: l.assignmentType,
      assignedAt: l.assignedAt.toISOString(),
      responseStatus: l.responseStatus,
      expiredAt: l.expiredAt ? l.expiredAt.toISOString() : null,
      notes: l.notes,
    })),
  };
}

export function toOrderListItemDto(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: Decimal;
  cashCollection: Decimal;
  createdAt: Date;
  updatedAt: Date;
  store: { id: string; name: string; area: string };
}): OrderListItemDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    area: order.area,
    amount: dec(order.amount),
    cashCollection: dec(order.cashCollection),
    store: { id: order.store.id, name: order.store.name, area: order.store.area },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
