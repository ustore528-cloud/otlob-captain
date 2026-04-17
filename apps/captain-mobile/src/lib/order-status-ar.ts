import type { OrderStatusDto } from "@/services/api/dto";

export const orderStatusAr: Record<OrderStatusDto, string> = {
  PENDING: "قيد الانتظار",
  CONFIRMED: "مؤكد",
  ASSIGNED: "معروض للكابتن",
  ACCEPTED: "مقبول",
  PICKED_UP: "تم الاستلام",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
};

/** حقل `responseStatus` في سجل التعيين */
export const assignmentResponseStatusAr: Record<string, string> = {
  PENDING: "في انتظار القرار",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  EXPIRED: "انتهت المهلة",
  CANCELLED: "ملغى",
};
