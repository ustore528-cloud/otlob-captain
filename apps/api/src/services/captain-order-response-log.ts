/**
 * قبول/رفض الكابتن — سجلات تشخيصية في stdout (تشغيل / إنتاج).
 */
export function logCaptainOrderResponse(event: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(
    "[CaptainOrderResponse]",
    JSON.stringify({ ts: new Date().toISOString(), event, ...payload }),
  );
}
