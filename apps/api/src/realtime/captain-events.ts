/**
 * أسماء أحداث Socket.IO المستقرة لتطبيق الكابتن (React Native / Flutter).
 * الاشتراك: بعد الاتصال بـ Socket.IO مع `auth: { token: "<accessJwt>" } }` يُضاف المستخدم تلقائيًا لغرفة `captain:<userId>`.
 */
export const CAPTAIN_SOCKET_EVENTS = {
  /** عرض جديد / إعادة تعيين — الحمولة: { kind, orderId, orderNumber, status, timeoutSeconds? } */
  ASSIGNMENT: "captain:assignment",
  /** انتهاء عرض لهذا الكابتن (رفض، انتهاء مهلة، إلغاء) — { orderId, reason } */
  ASSIGNMENT_ENDED: "captain:assignment:ended",
  /** تحديث حالة الطلب أو بياناته — { orderId, orderNumber, status } */
  ORDER_UPDATED: "captain:order:updated",
} as const;
