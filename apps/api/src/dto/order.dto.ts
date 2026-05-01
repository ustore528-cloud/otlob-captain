import type { AssignmentType, StoreSubscriptionType, UserRole } from "@prisma/client";
import {
  AssignmentResponseStatus,
  DistributionMode,
  OrderStatus,
  Prisma,
  UserRole as Ur,
} from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import {
  inferCanonicalOrderFinancialBreakdown,
  inferLegacyOrderFinancialBreakdown,
  type OrderFinancialBreakdownDto,
  type ValueTranslations,
} from "@captain/shared";
import {
  captainDisplayI18nFromJson,
  regionDisplayI18nFromJson,
  storeDisplayI18nFromJson,
  userDisplayI18nFromJson,
} from "../lib/display-i18n.js";
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
  /** Optional localized display overrides for fullName — canonical fields unchanged */
  displayI18n?: { fullName?: ValueTranslations };
} | null;

/** Phase A completion — read-only region summary on store (same on orders and /stores). */
export type StorePrimaryRegionSummaryDto = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  displayI18n?: { name?: ValueTranslations };
} | null;

export type StoreSummaryDto = {
  id: string;
  name: string;
  area: string;
  phone?: string;
  subscriptionType: StoreSubscriptionType;
  supervisorUser: OrderStoreSupervisorDto;
  primaryRegion: StorePrimaryRegionSummaryDto;
  displayI18n?: {
    name?: ValueTranslations;
    area?: ValueTranslations;
    address?: ValueTranslations;
    primaryRegionName?: ValueTranslations;
  };
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
  /** Per-company display sequence; null on legacy rows until backfill. */
  displayOrderNo: number | null;
  /** الكابتن المعيّن حاليًا على الطلب — يُستخدم للتمييز بين عرض قديم وبيانات الطلب الحالية */
  assignedCaptainId: string | null;
  status: OrderStatus;
  distributionMode: DistributionMode;
  companyId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  senderFullName: string | null;
  senderPhone: string | null;
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
  displayOrderNo: number | null;
  /** لتصفية أسطول لوحة الإسناد اليدوي (تطابق شركة الطلب؛ SUPER_ADMIN المنصّة لا يقيّد الفرع بالواجهة). */
  companyId: string;
  branchId: string;
  pickupLat: number | null;
  pickupLng: number | null;
  zoneId?: string | null;
  /** مُنشئ الطلب — عند SUPER_ADMIN يُعامل الطلب كطلب منصّة لتجربة الواجهة. */
  createdByRole: UserRole | null;
  isPlatformOrder: boolean;
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
    "id" | "name" | "area" | "subscriptionType" | "supervisorUser" | "primaryRegion" | "displayI18n"
  >;
  createdAt: string;
  updatedAt: string;
  assignedCaptain: null | {
    id: string;
    user: { fullName: string; phone: string; displayI18n?: { fullName?: ValueTranslations } };
    displayI18n?: { area?: ValueTranslations };
  };
  pendingOfferExpiresAt: string | null;
};

type OrderWithStore = {
  id: string;
  orderNumber: string;
  displayOrderNo?: number | null;
  assignedCaptainId: string | null;
  status: OrderStatus;
  distributionMode: DistributionMode;
  companyId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  senderFullName?: string | null;
  senderPhone?: string | null;
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
    displayI18n?: Prisma.JsonValue | null;
    supervisorUser: {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      role: UserRole;
      companyId: string | null;
      branchId: string | null;
      displayI18n?: Prisma.JsonValue | null;
    } | null;
    primaryRegion: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      displayI18n?: Prisma.JsonValue | null;
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
  const storeDi = storeDisplayI18nFromJson(order.store.displayI18n ?? undefined);
  const pr = order.store.primaryRegion;
  const prDi = pr ? regionDisplayI18nFromJson(pr.displayI18n ?? undefined) : undefined;
  const supUi = order.store.supervisorUser
    ? userDisplayI18nFromJson(order.store.supervisorUser.displayI18n ?? undefined)
    : undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    displayOrderNo: order.displayOrderNo ?? null,
    assignedCaptainId: order.assignedCaptainId,
    status: order.status,
    distributionMode: order.distributionMode,
    companyId: order.companyId,
    branchId: order.branchId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    senderFullName: order.senderFullName ?? null,
    senderPhone: order.senderPhone ?? null,
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
      ...(storeDi ? { displayI18n: storeDi } : {}),
      primaryRegion: order.store.primaryRegion
        ? {
            id: order.store.primaryRegion.id,
            code: order.store.primaryRegion.code,
            name: order.store.primaryRegion.name,
            isActive: order.store.primaryRegion.isActive,
            ...(prDi ? { displayI18n: prDi } : {}),
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
            ...(supUi ? { displayI18n: supUi } : {}),
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
  displayOrderNo?: number | null;
  companyId: string;
  branchId: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  zoneId?: string | null;
  createdBy?: { role: UserRole } | null;
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
    displayI18n?: Prisma.JsonValue | null;
    user: { fullName: string; phone: string; displayI18n?: Prisma.JsonValue | null };
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
    displayI18n?: Prisma.JsonValue | null;
    supervisorUser: {
      id: string;
      fullName: string;
      phone: string;
      email: string | null;
      role: UserRole;
      companyId: string | null;
      branchId: string | null;
      displayI18n?: Prisma.JsonValue | null;
    } | null;
    primaryRegion: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      displayI18n?: Prisma.JsonValue | null;
    } | null;
  };
}): OrderListItemDto {
  const sup = order.store.supervisorUser;
  const cap = order.assignedCaptain;
  const storeDi = storeDisplayI18nFromJson(order.store.displayI18n ?? undefined);
  const creatorRole = order.createdBy?.role ?? null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    displayOrderNo: order.displayOrderNo ?? null,
    companyId: order.companyId,
    branchId: order.branchId,
    pickupLat: order.pickupLat ?? null,
    pickupLng: order.pickupLng ?? null,
    zoneId: order.zoneId ?? null,
    createdByRole: creatorRole,
    isPlatformOrder: creatorRole === Ur.SUPER_ADMIN,
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
      ...(storeDi ? { displayI18n: storeDi } : {}),
      primaryRegion: order.store.primaryRegion
        ? (() => {
            const r = order.store.primaryRegion!;
            const rDi = regionDisplayI18nFromJson(r.displayI18n ?? undefined);
            return {
              id: r.id,
              code: r.code,
              name: r.name,
              isActive: r.isActive,
              ...(rDi ? { displayI18n: rDi } : {}),
            };
          })()
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
            ...(userDisplayI18nFromJson(sup.displayI18n ?? undefined)
              ? { displayI18n: userDisplayI18nFromJson(sup.displayI18n ?? undefined) }
              : {}),
          }
        : null,
    },
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    assignedCaptain: cap
      ? {
          id: cap.id,
          ...(captainDisplayI18nFromJson(cap.displayI18n ?? undefined)
            ? { displayI18n: captainDisplayI18nFromJson(cap.displayI18n ?? undefined) }
            : {}),
          user: {
            fullName: cap.user.fullName,
            phone: cap.user.phone,
            ...(userDisplayI18nFromJson(cap.user.displayI18n ?? undefined)
              ? { displayI18n: userDisplayI18nFromJson(cap.user.displayI18n ?? undefined) }
              : {}),
          },
        }
      : null,
    pendingOfferExpiresAt: pendingOfferExpiresAtIsoForListItem(order),
  };
}
