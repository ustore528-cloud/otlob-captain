/**
 * تسجيلات مسار مهلة التوزيع — مرئية في سجلات الخادم (Railway / Docker / stdout).
 */
export function logDistributionTimeout(event: string, payload?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    event,
    ...payload,
  };
  // eslint-disable-next-line no-console
  console.log("[DistributionTimeout]", JSON.stringify(line));
}
