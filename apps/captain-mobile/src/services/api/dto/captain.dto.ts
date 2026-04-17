import type { OrderDetailDto } from "./orders.dto";

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

/** GET /mobile/captain/me/assignment */
export type AssignmentLogDto = {
  id: string;
  assignedAt: string;
  expiresAt: string | null;
};

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
