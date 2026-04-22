import { paths } from "@captain/shared";
import { authRequest } from "../client";
import type {
  AssignmentOverflowResponse,
  CurrentAssignmentResponse,
  MeResponse,
  UpdateAvailabilityRequest,
  UpdateAvailabilityResponse,
  WorkStatusResponse,
} from "../dto";

export const captainService = {
  getMe(): Promise<MeResponse> {
    return authRequest<MeResponse>(paths.mobileCaptain.me, { method: "GET" });
  },

  /** Singular live assignment snapshot from the API (not a list). */
  getAssignment(): Promise<CurrentAssignmentResponse> {
    return authRequest<CurrentAssignmentResponse>(paths.mobileCaptain.assignment, { method: "GET" });
  },

  /** Secondary assignable / in-flight orders hidden from the primary live card. */
  getAssignmentOverflow(): Promise<AssignmentOverflowResponse> {
    return authRequest<AssignmentOverflowResponse>(paths.mobileCaptain.assignmentOverflow, { method: "GET" });
  },

  getWorkStatus(): Promise<WorkStatusResponse> {
    return authRequest<WorkStatusResponse>(paths.mobileCaptain.workStatus, { method: "GET" });
  },

  updateAvailability(body: UpdateAvailabilityRequest): Promise<UpdateAvailabilityResponse> {
    return authRequest<UpdateAvailabilityResponse>(paths.mobileCaptain.availability, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  registerPushToken(body: { token: string; platform: "android" | "ios"; appVersion?: string | null }): Promise<{
    registered: boolean;
  }> {
    return authRequest(paths.mobileCaptain.pushToken, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
