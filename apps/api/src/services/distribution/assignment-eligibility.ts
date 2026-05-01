import type { CaptainAvailabilityStatus, Prisma, UserRole } from "@prisma/client";
import { CaptainAvailabilityStatus as Cas, UserRole as Ur } from "@prisma/client";
import { AppError } from "../../utils/errors.js";
import type { AppRole } from "../../lib/rbac-roles.js";
import {
  type AutoDistributionPolicy,
  captainEligibleForManualOverride,
  maxActiveOrdersForAutoDistributionPolicy,
} from "./eligibility.js";

export type AssignmentEligibilityReasonCode =
  | "OK"
  | "DIFFERENT_COMPANY"
  | "BRANCH_NOT_ALLOWED"
  | "CAPTAIN_INACTIVE"
  | "CAPTAIN_UNAVAILABLE"
  | "CAPTAIN_TOO_FAR"
  | "REGION_NOT_ALLOWED";

export type AssignmentEligibilityMode = "AUTO_DISTRIBUTION" | "MANUAL_OVERRIDE" | "REASSIGN";

export type AssignmentEligibilityResult = {
  allowed: boolean;
  reasonCode: AssignmentEligibilityReasonCode;
  actorRole: AppRole;
  orderCompanyId: string;
  orderBranchId: string;
  captainCompanyId: string;
  captainBranchId: string;
  distanceMeters: number | null;
};

type EligibilityInputCaptain = {
  id: string;
  companyId: string;
  branchId: string;
  zoneId?: string | null;
  isActive: boolean;
  availabilityStatus: CaptainAvailabilityStatus;
  user: { isActive: boolean; role: UserRole };
};

/** أقصى مسافة (كم) لكابتن ترشيحي لطلب أُنشئه SUPER_ADMIN — لا يُطبّق بدون إحداثيات التقاط */
function superAdminPlatformMaxDistanceKm(): number {
  const raw = process.env.PLATFORM_SUPER_ADMIN_DISPATCH_MAX_DISTANCE_KM;
  const n = raw != null && raw.trim() !== "" ? Number.parseFloat(raw.trim()) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : 75;
}

/** Haversine بالمتر */
export function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isSuperAdminPlatformOrder(createdByRole: UserRole | null | undefined): boolean {
  return createdByRole === Ur.SUPER_ADMIN;
}

function baseResult(
  allowed: boolean,
  reasonCode: AssignmentEligibilityReasonCode,
  ctx: {
    actorRole: AppRole;
    order: { companyId: string; branchId: string };
    captain: EligibilityInputCaptain;
    distanceMeters: number | null;
  },
): AssignmentEligibilityResult {
  return {
    allowed,
    reasonCode,
    actorRole: ctx.actorRole,
    orderCompanyId: ctx.order.companyId,
    orderBranchId: ctx.order.branchId,
    captainCompanyId: ctx.captain.companyId,
    captainBranchId: ctx.captain.branchId,
    distanceMeters: ctx.distanceMeters,
  };
}

/**
 * Single source of truth for manual override + auto-pool candidate filtering.
 * - شركة الطلب = شركة الكابتن دائماً (بدون استثناءات).
 * - طلبات المنصة (المُنشِئ SUPER_ADMIN): لا تُفرض تطابق الفرع؛ يُمكن تطبيق مسافة من موقع الالتقاط إن وُجدت.
 * - الطلبات العادية: نفس الفرع إلزامي.
 */
export function canAssignCaptainToOrder(params: {
  actor: { role: AppRole };
  order: {
    companyId: string;
    branchId: string;
    zoneId?: string | null;
    pickupLat: number | null;
    pickupLng: number | null;
    createdByRole: UserRole | null | undefined;
  };
  captain: EligibilityInputCaptain;
  mode: AssignmentEligibilityMode;
  captainLatestLocation: { lat: number; lng: number } | null;
  activeBlockingOrderCount: number;
  autoDistributionPolicy?: AutoDistributionPolicy;
  /** When false, skip distance check (caller has no pickup or no captain ping) */
  applySuperAdminProximityGate: boolean;
}): AssignmentEligibilityResult {
  const { actor, order, captain, mode } = params;
  const platformSa = isSuperAdminPlatformOrder(order.createdByRole);

  const dist: number | null =
    params.applySuperAdminProximityGate &&
    platformSa &&
    params.captainLatestLocation != null &&
    order.pickupLat != null &&
    order.pickupLng != null
      ? haversineDistanceMeters(
          { lat: order.pickupLat, lng: order.pickupLng },
          params.captainLatestLocation,
        )
      : null;

  const ctx = {
    actorRole: actor.role,
    order: { companyId: order.companyId, branchId: order.branchId },
    captain,
    distanceMeters: dist,
  };

  if (captain.companyId !== order.companyId) {
    return baseResult(false, "DIFFERENT_COMPANY", ctx);
  }

  if (order.zoneId && captain.zoneId && order.zoneId !== captain.zoneId) {
    return baseResult(false, "REGION_NOT_ALLOWED", ctx);
  }

  if (!platformSa && order.branchId !== captain.branchId) {
    return baseResult(false, "BRANCH_NOT_ALLOWED", ctx);
  }

  const manualStyle = mode === "MANUAL_OVERRIDE" || mode === "REASSIGN";

  if (!captain.isActive || !captain.user.isActive) {
    return baseResult(false, "CAPTAIN_INACTIVE", ctx);
  }
  if (captain.user.role !== Ur.CAPTAIN) {
    return baseResult(false, "CAPTAIN_INACTIVE", ctx);
  }

  if (manualStyle) {
    if (!captainEligibleForManualOverride(captain)) {
      return baseResult(false, "CAPTAIN_UNAVAILABLE", ctx);
    }
  } else if (captain.availabilityStatus !== Cas.AVAILABLE) {
    return baseResult(false, "CAPTAIN_UNAVAILABLE", ctx);
  }

  if (!manualStyle) {
    const policy = params.autoDistributionPolicy ?? "DEFAULT_SINGLE_ORDER";
    const capMax = maxActiveOrdersForAutoDistributionPolicy(policy);
    if (params.activeBlockingOrderCount >= capMax) {
      return baseResult(false, "CAPTAIN_UNAVAILABLE", ctx);
    }
  }

  if (
    platformSa &&
    params.applySuperAdminProximityGate &&
    order.pickupLat != null &&
    order.pickupLng != null &&
    params.captainLatestLocation != null
  ) {
    const km = (dist ?? 0) / 1000;
    if (km > superAdminPlatformMaxDistanceKm()) {
      return baseResult(false, "CAPTAIN_TOO_FAR", ctx);
    }
  }

  return baseResult(true, "OK", ctx);
}

export function logAssignmentEligibilityAudit(
  phase: string,
  params: {
    orderNumber: string;
    orderCompanyId: string;
    orderBranchId: string;
    actorRole: AppRole;
    pickupLat: number | null;
    pickupLng: number | null;
    captainName: string;
    captainPhone: string;
    captainCompanyId: string;
    captainBranchId: string;
    distanceMeters: number | null;
    allowed: boolean;
    reasonCode: AssignmentEligibilityReasonCode;
  },
): void {
  // eslint-disable-next-line no-console
  console.info("[assign-eligibility-audit]", {
    phase,
    at: new Date().toISOString(),
    orderNumber: params.orderNumber,
    orderCompanyId: params.orderCompanyId,
    orderBranchId: params.orderBranchId,
    actorRole: params.actorRole,
    pickupLat: params.pickupLat,
    pickupLng: params.pickupLng,
    captainName: params.captainName,
    captainPhone: params.captainPhone,
    captainCompanyId: params.captainCompanyId,
    captainBranchId: params.captainBranchId,
    distanceMeters: params.distanceMeters,
    allowed: params.allowed,
    reasonCode: params.reasonCode,
  });
}

const httpStatusByReason: Partial<Record<AssignmentEligibilityReasonCode, number>> = {
  DIFFERENT_COMPANY: 403,
  BRANCH_NOT_ALLOWED: 403,
  REGION_NOT_ALLOWED: 403,
  CAPTAIN_INACTIVE: 400,
  CAPTAIN_UNAVAILABLE: 400,
  CAPTAIN_TOO_FAR: 400,
};

const codeByReason: Record<AssignmentEligibilityReasonCode, string> = {
  OK: "ASSIGN_OK",
  DIFFERENT_COMPANY: "ASSIGN_DIFFERENT_COMPANY",
  BRANCH_NOT_ALLOWED: "ASSIGN_BRANCH_NOT_ALLOWED",
  CAPTAIN_INACTIVE: "ASSIGN_CAPTAIN_INACTIVE",
  CAPTAIN_UNAVAILABLE: "ASSIGN_CAPTAIN_UNAVAILABLE",
  CAPTAIN_TOO_FAR: "ASSIGN_CAPTAIN_TOO_FAR",
  REGION_NOT_ALLOWED: "ASSIGN_REGION_NOT_ALLOWED",
};

const messageByReason: Record<Exclude<AssignmentEligibilityReasonCode, "OK">, string> = {
  DIFFERENT_COMPANY: "Captain belongs to a different company.",
  BRANCH_NOT_ALLOWED: "Captain is not allowed to serve this branch.",
  CAPTAIN_INACTIVE: "Captain account is inactive.",
  CAPTAIN_UNAVAILABLE: "Captain is not eligible for this assignment.",
  CAPTAIN_TOO_FAR: "Captain is too far from the pickup location for this dispatch.",
  REGION_NOT_ALLOWED: "Captain is not allowed for this order’s region/zone.",
};

export function assertAssignmentEligibilityOrThrow(r: AssignmentEligibilityResult): void {
  if (r.allowed) return;
  const status = httpStatusByReason[r.reasonCode] ?? 400;
  const code = codeByReason[r.reasonCode];
  const message = messageByReason[r.reasonCode as Exclude<typeof r.reasonCode, "OK">] ?? "Assignment not allowed.";
  throw new AppError(status, message, code);
}

export async function loadLatestCaptainLocationsTx(
  tx: Prisma.TransactionClient,
  captainIds: string[],
): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>();
  if (captainIds.length === 0) return out;

  const rows = await tx.captainLocation.findMany({
    where: { captainId: { in: [...new Set(captainIds)] } },
    orderBy: { recordedAt: "desc" },
    select: { captainId: true, latitude: true, longitude: true },
  });
  for (const row of rows) {
    if (!out.has(row.captainId)) {
      out.set(row.captainId, { lat: row.latitude, lng: row.longitude });
    }
  }
  return out;
}
