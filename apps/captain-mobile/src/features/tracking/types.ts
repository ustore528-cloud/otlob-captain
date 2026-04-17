import type { CaptainLocationRecordDto } from "@/services/api/dto";

export type ForegroundPermissionState = "unknown" | "granted" | "denied";

export type NetworkReachability = "online" | "offline" | "unknown";

/** لقطة لعرضها في الواجهة — لا تُخزَّن في الـ store العام */
export type CaptainTrackingSnapshot = {
  /** المستخدم فعّل التتبع من الواجهة */
  sessionEnabled: boolean;
  permission: ForegroundPermissionState;
  /** الشبكة (NetInfo) */
  reachability: NetworkReachability;
  /** التطبيق في المقدّمة — عند الخلفية نوقف الحلقة حتى يُفعَّل التتبع بالخلفية */
  appInForeground: boolean;
  lastFix: { latitude: number; longitude: number; recordedAtMs: number } | null;
  lastServerAck: CaptainLocationRecordDto | null;
  pendingInOutbox: number;
  /** آخر مشكلة للعرض (لا تُمسح تلقائيًا إلا عند نجاح لاحق) */
  lastIssue: TrackingIssue | null;
};

export type TrackingIssue =
  | { kind: "permission_denied"; message: string }
  | { kind: "gps_unavailable"; message: string }
  | { kind: "network"; message: string }
  | { kind: "server"; message: string; retryable: boolean };
