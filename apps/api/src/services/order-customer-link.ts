import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[\s()-]/g, "");
}

/**
 * يربط الطلب بحساب عميل (CUSTOMER) إن وُجد:
 * - `explicitCustomerUserId` من الجسم عند التحقق
 * - أو مطابقة هاتف الطلب مع مستخدم بدور CUSTOMER
 */
export async function resolveOrderCustomerUserId(params: {
  explicitCustomerUserId?: string | null;
  customerPhone: string;
}): Promise<string | undefined> {
  if (params.explicitCustomerUserId) {
    const u = await prisma.user.findFirst({
      where: {
        id: params.explicitCustomerUserId,
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    });
    if (!u) {
      throw new AppError(400, "معرّف عميل غير صالح أو الحساب غير نشط", "INVALID_CUSTOMER_USER");
    }
    return u.id;
  }

  const want = normalizePhoneDigits(params.customerPhone);
  if (!want) return undefined;

  const customers = await prisma.user.findMany({
    where: { role: UserRole.CUSTOMER, isActive: true },
    select: { id: true, phone: true },
  });
  const match = customers.find((c) => normalizePhoneDigits(c.phone) === want);
  return match?.id;
}
