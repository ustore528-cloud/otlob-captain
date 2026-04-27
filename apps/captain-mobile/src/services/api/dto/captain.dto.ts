import type { OrderDetailDto, OrderStatusDto } from "./orders.dto";

export type CaptainAvailabilityStatus =
  | "OFFLINE"
  | "AVAILABLE"
  | "BUSY"
  | "ON_DELIVERY";

export type CaptainProfileDto = {
  id: string;
  vehicleType: string;
  area: string | null;
  availabilityStatus: string;
  isActive: boolean;
  lastSeenAt?: string | null;
  prepaidBalance?: CaptainPrepaidSummaryDto;
};

export type CaptainPrepaidReadAlignmentDto = {
  displayBalance: string;
  walletBalance: string | null;
  prepaidBalance: string;
  parity: "OK" | "NO_WALLET" | "MISMATCH";
};

export type CaptainPrepaidSummaryDto = {
  captainId: string;
  currentBalance: string;
  prepaidBalance: string;
  commissionPercent: string;
  prepaidEnabled: boolean;
  captainPrepaidEnabled: boolean;
  systemPrepaidEnabled: boolean;
  totalCharged: string;
  totalDeducted: string;
  minimumBalanceToReceiveOrders: string;
  lowBalance: boolean;
  blockedFromReceivingOrders: boolean;
  blockReason: string | null;
  estimatedRemainingOrders: number | null;
  lastBalanceUpdatedAt: string | null;
  lastChargeAt: string | null;
  lastDeductionAt: string | null;
  explanationText: string;
  /** Present when API runs read-alignment phase; use `currentBalance` when absent. */
  readAlignment?: CaptainPrepaidReadAlignmentDto;
};

export type SessionUserDto = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  /** Present on login payload; optional on GET /me. */
  role?: string;
};

/** GET /mobile/captain/me */
export type MeResponse = {
  user: SessionUserDto;
  captain: CaptainProfileDto;
};

/** PATCH /mobile/captain/me/availability */
export type UpdateAvailabilityRequest = {
  availabilityStatus: CaptainAvailabilityStatus;
};

export type UpdateAvailabilityResponse = {
  captain: Pick<CaptainProfileDto, "id" | "availabilityStatus"> & { lastSeenAt: string | null };
};

/** Quick work-status codes — same as admin dashboard quick alert. */
export type QuickWorkStatusCode = "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";

/** GET /mobile/captain/me/work-status — latest admin broadcast (activity log). */
export type WorkStatusResponse =
  | { active: false }
  | {
      active: true;
      code: QuickWorkStatusCode;
      /** Arabic label from server (admin source of truth). */
      label: string;
      updatedAt: string;
    };

export type AssignmentLogDto = {
  id: string;
  assignedAt: string;
  expiresAt: string | null;
};

/**
 * GET /mobile/captain/me/assignment — **intentionally singular**: NONE, one OFFER, or one ACTIVE order per response.
 * Not a list of concurrent live orders unless the API contract changes.
 */
export type CurrentAssignmentResponse =
  | { state: "NONE" }
  | {
      state: "OFFER";
      timeoutSeconds: number;
      log: AssignmentLogDto;
      order: OrderDetailDto;
    }
  | {
      state: "ACTIVE";
      order: OrderDetailDto;
    };

/** GET /mobile/captain/me/assignment/overflow — not the primary card; see `CurrentAssignmentResponse`. */
export type AssignmentOverflowItemDto = {
  orderId: string;
  orderNumber: string;
  displayOrderNo?: number | null;
  kind: "OFFER" | "ACTIVE";
  status: OrderStatusDto;
  customerPhone: string;
  amount: string;
  deliveryFee: string | null;
  cashCollection: string;
  pickupAddress: string;
  dropoffAddress: string;
  storeName: string;
  offerExpiresAt: string | null;
};

export type AssignmentOverflowResponse = {
  primaryOrderId: string | null;
  items: AssignmentOverflowItemDto[];
};
