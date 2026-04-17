/**
 * تتبع موقع الكابتن — مقدّمة التطبيق، إرسال للخادم، طابور عند انقطاع الشبكة.
 * التتبع في الخلفية: راجع `background-contract.ts` و `config.ts`.
 */
export { TRACKING_CONFIG, BACKGROUND_LOCATION_TASK_NAME } from "./config";
export type { CaptainTrackingSnapshot, ForegroundPermissionState, NetworkReachability, TrackingIssue } from "./types";
export { useCaptainTracking, type UseCaptainTrackingResult } from "./use-captain-tracking";
export { useNetworkReachability } from "./network";
export { requestForegroundPermission, getForegroundPermissionState } from "./permission";
export { sendCaptainLocationReliable } from "./sender";
export { LocationOutbox } from "./outbox";
export { registerBackgroundTrackingPlaceholder } from "./background-contract";
export { TrackingScreen } from "./screens/tracking-screen";
