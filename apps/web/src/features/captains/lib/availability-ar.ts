/** تسميات حالة التوفر كما في تطبيق الكابتن — يمكن مواءمتها مع enum الخادم لاحقًا */
export function availabilityAr(s: string): string {
  const m: Record<string, string> = {
    OFFLINE: "غير متصل",
    AVAILABLE: "متاح",
    BUSY: "مشغول",
    ON_DELIVERY: "في التوصيل",
  };
  return m[s] ?? s;
}
