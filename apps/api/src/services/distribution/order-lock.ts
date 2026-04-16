import { Prisma } from "@prisma/client";

/**
 * قفل معاملات لكل طلب — يمنع سباقين على نفس orderId (queue-safe لعمليات التوزيع).
 * يستخدم pg_advisory_xact_lock يُطلق تلقائيًا عند نهاية المعاملة.
 */
export async function lockOrderDistributionTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const key = `distribution:order:${orderId}`;
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}::text))`);
}
