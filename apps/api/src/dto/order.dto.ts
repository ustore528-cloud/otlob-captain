import type { AssignmentType, StoreSubscriptionType, UserRole } from "@prisma/client";
import {
  AssignmentResponseStatus,
  DistributionMode,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import {
  inferCanonicalOrderFinancialBreakdown,
  inferLegacyOrderFinancialBreakdown,
  type OrderFinancialBreakdownDto,
} from "@captain/shared";
import { clampOfferExpiredAtToConfiguredWindow } from "../services/distribution/clamp-offer-expired-at.js";

function dec(v: Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

/** ISO expiry for active captain offer (ASSIGNED + matching PENDING log). */
function pendingOfferExpiresAtIsoForListItem(order: {
  status: OrderStatus;
  assignedCaptainId: string | null;
  assignmentLogs?: Array<{
    captainId: string;
    assignedAt: Date;
    expiredAt: Date | null;
    responseStatus: AssignmentResponseStatus;
  }>;
}): string | null {
  if (order.status !== OrderStatus.ASSIGNED || !order.assignedCaptainId) return null;
  const log = order.assignmentLogs?.find(
    (l) =>
      l.responseStatus === AssignmentResponseStatus.PENDING &&
      l.captainId === order.assignedCaptainId &&
      l.expiredAt != null,
  );
  if (!log?.expiredAt) return null;
  const clamped = clampOfferExpiredAtToConfiguredWindow(log.assignedAt, log.expiredAt);
  return clamped ? clamped.toISOString() : null;
}

/** Linked supervisor user (read-only) — same shape on store listing/detail order payloads, Phase B slice 3 */
export type OrderStoreSupervisorDto = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
} | null;

/** Phase A completion — read-only region summary on store (same on orders and /stores). */
export type StorePrimaryRegionSummaryDto = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
} | null;

export type StoreSummaryDto = {
  id: string;
  name: string;
  area: string;
  phone?: string;
  subscriptionType: StoreSubscriptionType;
  supervisorUser: OrderStoreSupervisorDto;
  primaryRegion: StorePrimaryRegionSummaryDto;
};

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
  distributionMode: DistributionMode;
  companyId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  area: string;
  amount: string;
  cashCollection: string;
  /** رسوم توصيل مخزّنة صراحةً في الطلب إن وُجدت */
  deliveryFee: string | null;
  /**
   * Captain-facing money lines. Uses canonical rules when `deliveryFee` is stored on the order;
   * otherwise falls back to legacy inference for older rows (`delivery_fee` null).
   */
  financialBreakdown: OrderFinancialBreakdownDto;
  /**
   * Estimated commission for display: `financialBreakdown.deliveryFee` × assigned captain commission %.
   * Null if no assignee or no percent.
   */
  commissionEstimate: string | null;
  /** Earliest assignment log `assigned_at` (first offer / assignment). */
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
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
  distributionMode: DistributionMode;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  /** Persisted delivery fee; null on legacy rows (UI may infer for display). */
  deliveryFee: string | null;
  notes: string | null;
  store: Pick<
    StoreSummaryDto,
    "id" | "name" | "area" | "subscriptionType" | "supervisorUser" | "primaryRegion"
  >;
  createdAt: string;
  updatedAt: string;
  assignedCaptain: null | {
    id: string;
    user: { fullName: string; phone: string };
  };
  pendingOfferExpiresAt: string | null;
};

type OrderWithStore = {
  id: string;
  orderNumber: string;
  assignedCaptainId: string | null;
  status: OrderStatus;
  distributionMode: DistributionMode;
  companyId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  area: string;
  amount: Decimal;
  cashCollection: Decimal;
  deliveryFee: Decimal | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  assignedCaptain?: { commissionPercent: Prisma.Decimal | null } | null;
  store: {
    id: string;
    name: string;
    area: string;
    phone?: string;
    subscriptionType: StoreSubscriptionType;
    supervisorUser: {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      role: UserRole;
      companyId: string | null;
      branchId: string | null;
    } | null;
    primaryRegion: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
    } | null;
  };
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

function earliestAssignmentAtIso(logs: Array<{ assignedAt: Date }> | undefined): string | null {
  if (!logs?.length) return null;
  const minMs = logs.reduce((m, l) => Math.min(m, l.assignedAt.getTime()), logs[0]!.assignedAt.getTime());
  return new Date(minMs).toISOString();
}

function commissionEstimateFromCaptain(
  captain: { commissionPercent: Prisma.Decimal | null } | null | undefined,
  deliveryFeeLine: string,
): string | null {
  if (!captain || captain.commissionPercent == null) return null;
  const fee = new Prisma.Decimal(deliveryFeeLine);
  const pct = new Prisma.Decimal(captain.commissionPercent);
  return fee.mul(pct).div(100).toFixed(2);
}

export function toOrderDetailDto(order: OrderWithStore): OrderDetailDto {
  const amountStr = dec(order.amount);
  const cashStr = dec(order.cashCollection);
  const deliveryFeeStr = order.deliveryFee != null ? dec(order.deliveryFee) : null;
  const financialBreakdown =
    deliveryFeeStr != null
      ? inferCanonicalOrderFinancialBreakdown(amountStr, deliveryFeeStr, cashStr)
      : inferLegacyOrderFinancialBreakdown(amountStr, cashStr);
  const commissionEstimate = commissionEstimateFromCaptain(order.assignedCaptain ?? null, financialBreakdown.deliveryFee);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    assignedCaptainId: order.assignedCaptainId,
    status: order.status,
    distributionMode: order.distributionMode,
    companyId: order.companyId,
    branchId: order.branchId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    pickupLat: order.pickupLat ?? null,
    pickupLng: order.pickupLng ?? null,
    dropoffLat: order.dropoffLat ?? null,
    dropoffLng: order.dropoffLng ?? null,
    area: order.area,
    amount: amountStr,
    cashCollection: cashStr,
    deliveryFee: deliveryFeeStr,
    financialBreakdown,
    commissionEstimate,
    assignedAt: earliestAssignmentAtIso(order.assignmentLogs),
    pickedUpAt: order.pickedUpAt ? order.pickedUpAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    notes: order.notes,
    store: {
      id: order.store.id,
      name: order.store.name,
      area: order.store.area,
      subscriptionType: order.store.subscriptionType,
      primaryRegion: order.store.primaryRegion
        ? {
            id: order.store.primaryRegion.id,
            code: order.store.primaryRegion.code,
            name: order.store.primaryRegion.name,
            isActive: order.store.primaryRegion.isActive,
          }
        : null,
      supervisorUser: order.store.supervisorUser
        ? {
            id: order.store.supervisorUser.id,
            fullName: order.store.supervisorUser.fullName,
            phone: order.store.supervisorUser.phone,
            email: order.store.supervisorUser.email,
            role: order.store.supervisorUser.role,
            companyId: order.store.supervisorUser.companyId,
            branchId: order.store.supervisorUser.branchId,
          }
        : null,
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
  distributionMode: DistributionMode;
  assignedCaptainId: string | null;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: Decimal;
  cashCollection: Decimal;
  deliveryFee: Decimal | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedCaptain?: {
    id: string;
    user: { fullName: string; phone: string };
  } | null;
  assignmentLogs?: Array<{
    captainId: string;
    assignedAt: Date;
    expiredAt: Date | null;
    responseStatus: AssignmentResponseStatus;
  }>;
  store: {
    id: string;
    name: string;
    area: string;
    subscriptionType: StoreSubscriptionType;
    supervisorUser: {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      role: UserRole;
      companyId: string | null;
      branchId: string | null;
    } | null;
    primaryRegion: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
    } | null;
  };
}): OrderListItemDto {
  const sup = order.store.supervisorUser;
  const cap = order.assignedCaptain;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    distributionMode: order.distributionMode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    area: order.area,
    amount: dec(order.amount),
    cashCollection: dec(order.cashCollection),
    deliveryFee: order.deliveryFee != null ? dec(order.deliveryFee) : null,
    notes: order.notes,
    store: {
      id: order.store.id,
      name: order.store.name,
      area: order.store.area,
      subscriptionType: order.store.subscriptionType,
      primaryRegion: order.store.primaryRegion
        ? {
            id: order.store.primaryRegion.id,
            code: order.store.primaryRegion.code,
            name: order.store.primaryRegion.name,
            isActive: order.store.primaryRegion.isActive,
          }
        : null,
      supervisorUser: sup
        ? {
            id: sup.id,
            fullName: sup.fullName,
            phone: sup.phone,
            email: sup.email,
            role: sup.role,
            companyId: sup.companyId,
            branchId: sup.branchId,
          }
        : null,
    },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    assignedCaptain: cap
      ? {
          id: cap.id,
          user: { fullName: cap.user.fullName, phone: cap.user.phone },
        }
      : null,
    pendingOfferExpiresAt: pendingOfferExpiresAtIsoForListItem(order),
  };
}
