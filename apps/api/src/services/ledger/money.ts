import { Prisma } from "@prisma/client";

export const ZERO = new Prisma.Decimal(0);

export function money(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
