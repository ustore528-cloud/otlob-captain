export { paths } from "@captain/shared";

export { ApiClientError, ApiError } from "./errors";
export type { ApiEnvelope, ApiErrorEnvelope, ApiSuccessEnvelope } from "./types";

export { rawRequest, authRequest, buildQueryString } from "./client";
export { registerTokenBridge, getTokenBridge, assertTokenBridge, type TokenBridge } from "./token-bridge";

export * from "./dto";

export {
  authService,
  captainService,
  ordersService,
  trackingService,
  notificationsService,
} from "./services";
