import type { ActiveMapCaptain } from "@/types/api";

/** أولوية مطابقة لخريطة التوزيع: انتظار قبول → تسليم نشط → رفض حديث → متاح */
export function captainMapVisual(c: ActiveMapCaptain): {
  border: string;
  bg: string;
  pulse: boolean;
  label: string;
} {
  if (c.waitingOffers > 0) {
    return {
      border: "#ca8a04",
      bg: "#fef9c3",
      pulse: true,
      label: "بانتظار قبول الكابتن",
    };
  }
  if (c.activeOrders > 0) {
    return {
      border: "#15803d",
      bg: "#dcfce7",
      pulse: true,
      label: "قُبِل الطلب / قيد التوصيل",
    };
  }
  if (c.recentRejects > 0) {
    return {
      border: "#b91c1c",
      bg: "#fee2e2",
      pulse: true,
      label: "رفض مؤخراً",
    };
  }
  return {
    border: "#2563eb",
    bg: "#dbeafe",
    pulse: false,
    label: "متاح",
  };
}

/** متبقي من مهلة العرض (للعدّ على الخريطة أو لوحة الإفلات) */
export function assignmentOfferSecondsLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}
