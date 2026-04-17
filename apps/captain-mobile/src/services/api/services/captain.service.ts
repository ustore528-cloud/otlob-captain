import { paths } from "@captain/shared";
import { authRequest } from "../client";
import type {
  CurrentAssignmentResponse,
  MeResponse,
  UpdateAvailabilityRequest,
  UpdateAvailabilityResponse,
} from "../dto";

export const captainService = {
  getMe(): Promise<MeResponse> {
    return authRequest<MeResponse>(paths.mobileCaptain.me, { method: "GET" });
  },

  getAssignment(): Promise<CurrentAssignmentResponse> {
    return authRequest<CurrentAssignmentResponse>(paths.mobileCaptain.assignment, { method: "GET" });
  },

  updateAvailability(body: UpdateAvailabilityRequest): Promise<UpdateAvailabilityResponse> {
    return authRequest<UpdateAvailabilityResponse>(paths.mobileCaptain.availability, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};
