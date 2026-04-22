/**
 * رقم ترتيب عرض في **صفحة التوزيع فقط** (قائمة مدمجة حسب الحالة).
 *
 * ليس معرفاً مستقلاً في قاعدة البيانات — يتغير عند تغيير الفرز، أو عند دخول/خروج طلبات من القائمة.
 * آمن ولا يمس منطق الطلبات أو الـ API.
 */
export function formatDistributionQueueSerial(index: number, totalInView: number): string {
  const n = index + 1;
  const width = Math.max(2, String(Math.max(totalInView, n)).length);
  return String(n).padStart(width, "0");
}
