/**
 * تسجيلات تشخيصية لتعقّب التعيين الحالي — تظهر في Metro فقط عند __DEV__.
 */
const PREFIX = "[CaptainAssignment]";

/** قبول/رفض الطلب — يُسجّل دائمًا في Metro/الجهاز لتتبع عدم التزامن مع الخادم */
export function logCaptainOrderInteraction(event: string, payload?: Record<string, unknown>): void {
  const line = { ts: new Date().toISOString(), event, ...payload };
  // eslint-disable-next-line no-console
  console.log("[CaptainOrder]", JSON.stringify(line));
}

export function logCaptainAssignment(
  event:
    | "FETCH_START"
    | "FETCH_SUCCESS"
    | "FETCH_ERROR"
    | "DATA_UPDATED"
    | "FOCUS_REFETCH"
    | "SOCKET_INVALIDATE"
    | "APP_FOREGROUND_INVALIDATE"
    | "QUERY_STATUS",
  payload?: Record<string, unknown>,
): void {
  if (!__DEV__) return;
  if (payload && Object.keys(payload).length > 0) {
    console.log(PREFIX, event, payload);
  } else {
    console.log(PREFIX, event);
  }
}
