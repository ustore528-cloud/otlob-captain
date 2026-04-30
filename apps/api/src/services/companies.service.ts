import { prisma } from "../lib/prisma.js";
import { companyDisplayI18nFromJson } from "../lib/display-i18n.js";
import { AppError } from "../utils/errors.js";

export type CompanyListItem = {
  id: string;
  name: string;
  incubatorMotherName?: string | null;
  deliveryPricing: {
    mode: "FIXED" | "DISTANCE_BASED";
    fixedDeliveryFee: string | null;
    baseDeliveryFee: string | null;
    pricePerKm: string | null;
    roundingMode: "CEIL" | "ROUND" | "NONE";
  };
  displayI18n?: { name?: import("@captain/shared").ValueTranslations };
};

function mapCompanyRow(row: {
  id: string;
  name: string;
  incubatorMotherName?: string | null;
  deliverySettings?: {
    deliveryPricingMode?: "FIXED" | "DISTANCE_BASED";
    fixedDeliveryFee?: { toString(): string } | null;
    baseDeliveryFee?: { toString(): string } | null;
    pricePerKm?: { toString(): string } | null;
    deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
    defaultDeliveryFee?: { toString(): string } | null;
  } | null;
  displayI18n?: import("@prisma/client").Prisma.JsonValue | null;
}): CompanyListItem {
  const d = companyDisplayI18nFromJson(row.displayI18n ?? undefined);
  const pricingMode = row.deliverySettings?.deliveryPricingMode ?? "FIXED";
  const fixedDeliveryFee =
    row.deliverySettings?.fixedDeliveryFee?.toString() ??
    row.deliverySettings?.defaultDeliveryFee?.toString() ??
    null;
  return {
    id: row.id,
    name: row.name,
    incubatorMotherName: row.incubatorMotherName ?? null,
    deliveryPricing: {
      mode: pricingMode,
      fixedDeliveryFee,
      baseDeliveryFee: row.deliverySettings?.baseDeliveryFee?.toString() ?? null,
      pricePerKm: row.deliverySettings?.pricePerKm?.toString() ?? null,
      roundingMode: row.deliverySettings?.deliveryFeeRoundingMode ?? "CEIL",
    },
    ...(d ? { displayI18n: d } : {}),
  };
}

/** Active companies — SUPER_ADMIN company picker only. */
export async function listActiveCompaniesForSuperAdmin(): Promise<CompanyListItem[]> {
  const rows = await prisma.company.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      incubatorMotherName: true,
      displayI18n: true,
      deliverySettings: {
        select: {
          deliveryPricingMode: true,
          fixedDeliveryFee: true,
          baseDeliveryFee: true,
          pricePerKm: true,
          deliveryFeeRoundingMode: true,
          defaultDeliveryFee: true,
        },
      },
    },
    orderBy: { name: "asc" },
  } as any);
  return (
    rows as Array<{
      id: string;
      name: string;
      incubatorMotherName?: string | null;
      displayI18n?: unknown;
      deliverySettings?: {
        deliveryPricingMode?: "FIXED" | "DISTANCE_BASED";
        fixedDeliveryFee?: { toString(): string } | null;
        baseDeliveryFee?: { toString(): string } | null;
        pricePerKm?: { toString(): string } | null;
        deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
        defaultDeliveryFee?: { toString(): string } | null;
      } | null;
    }>
  ).map((row) =>
    mapCompanyRow({
      id: row.id,
      name: row.name,
      incubatorMotherName: row.incubatorMotherName ?? null,
      deliverySettings: row.deliverySettings ?? null,
      displayI18n: row.displayI18n as import("@prisma/client").Prisma.JsonValue | null | undefined,
    }),
  );
}

/** إنشاء شركة نشطة — معرّف تلقائي من قاعدة البيانات */
export async function createCompanyForSuperAdmin(input: {
  name: string;
  incubatorMotherName?: string | null;
  deliveryPricing: {
    deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
    fixedDeliveryFee?: number;
    baseDeliveryFee?: number;
    pricePerKm?: number;
    deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
  };
}): Promise<CompanyListItem> {
  const name = input.name.trim();
  const incubatorMotherName = input.incubatorMotherName?.trim() ? input.incubatorMotherName.trim() : null;
  const row = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name, incubatorMotherName, isActive: true },
      select: { id: true, name: true, incubatorMotherName: true, displayI18n: true },
    } as any);
    const mode = input.deliveryPricing.deliveryPricingMode;
    const fixed = mode === "FIXED" ? input.deliveryPricing.fixedDeliveryFee ?? 0 : null;
    const base = mode === "DISTANCE_BASED" ? input.deliveryPricing.baseDeliveryFee ?? 0 : null;
    const perKm = mode === "DISTANCE_BASED" ? input.deliveryPricing.pricePerKm ?? 0 : null;
    await tx.deliverySettings.create({
      data: {
        companyId: (company as { id: string }).id,
        deliveryPricingMode: mode,
        fixedDeliveryFee: fixed,
        baseDeliveryFee: base,
        pricePerKm: perKm,
        deliveryFeeRoundingMode: input.deliveryPricing.deliveryFeeRoundingMode ?? "CEIL",
        defaultDeliveryFee: mode === "FIXED" ? fixed : base,
      } as any,
    });
    return tx.company.findUnique({
      where: { id: (company as { id: string }).id },
      select: {
        id: true,
        name: true,
        incubatorMotherName: true,
        displayI18n: true,
        deliverySettings: {
          select: {
            deliveryPricingMode: true,
            fixedDeliveryFee: true,
            baseDeliveryFee: true,
            pricePerKm: true,
            deliveryFeeRoundingMode: true,
            defaultDeliveryFee: true,
          },
        },
      },
    } as any);
  });
  return mapCompanyRow({
    id: (row as { id: string }).id,
    name: (row as { name: string }).name,
    incubatorMotherName: (row as { incubatorMotherName?: string | null }).incubatorMotherName ?? null,
    deliverySettings: (row as { deliverySettings?: unknown }).deliverySettings as {
      deliveryPricingMode?: "FIXED" | "DISTANCE_BASED";
      fixedDeliveryFee?: { toString(): string } | null;
      baseDeliveryFee?: { toString(): string } | null;
      pricePerKm?: { toString(): string } | null;
      deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      defaultDeliveryFee?: { toString(): string } | null;
    } | null,
    displayI18n: (row as { displayI18n?: import("@prisma/client").Prisma.JsonValue | null }).displayI18n,
  });
}

export async function updateCompanyForSuperAdmin(
  companyId: string,
  input: {
    name?: string;
    incubatorMotherName?: string | null;
    deliveryPricing?: {
      deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
      fixedDeliveryFee?: number;
      baseDeliveryFee?: number;
      pricePerKm?: number;
      deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
    };
  },
): Promise<CompanyListItem> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new AppError(404, "Company not found", "NOT_FOUND");
  const row = await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.incubatorMotherName !== undefined
          ? { incubatorMotherName: input.incubatorMotherName?.trim() ? input.incubatorMotherName.trim() : null }
          : {}),
      },
    });
    if (input.deliveryPricing) {
      const mode = input.deliveryPricing.deliveryPricingMode;
      const fixed = mode === "FIXED" ? input.deliveryPricing.fixedDeliveryFee ?? 0 : null;
      const base = mode === "DISTANCE_BASED" ? input.deliveryPricing.baseDeliveryFee ?? 0 : null;
      const perKm = mode === "DISTANCE_BASED" ? input.deliveryPricing.pricePerKm ?? 0 : null;
      await tx.deliverySettings.upsert({
        where: { companyId },
        create: {
          companyId,
          deliveryPricingMode: mode,
          fixedDeliveryFee: fixed,
          baseDeliveryFee: base,
          pricePerKm: perKm,
          deliveryFeeRoundingMode: input.deliveryPricing.deliveryFeeRoundingMode ?? "CEIL",
          defaultDeliveryFee: mode === "FIXED" ? fixed : base,
        } as any,
        update: {
          deliveryPricingMode: mode,
          fixedDeliveryFee: fixed,
          baseDeliveryFee: base,
          pricePerKm: perKm,
          deliveryFeeRoundingMode: input.deliveryPricing.deliveryFeeRoundingMode ?? "CEIL",
          defaultDeliveryFee: mode === "FIXED" ? fixed : base,
        } as any,
      });
    }
    return tx.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        incubatorMotherName: true,
        displayI18n: true,
        deliverySettings: {
          select: {
            deliveryPricingMode: true,
            fixedDeliveryFee: true,
            baseDeliveryFee: true,
            pricePerKm: true,
            deliveryFeeRoundingMode: true,
            defaultDeliveryFee: true,
          },
        },
      },
    } as any);
  });
  return mapCompanyRow({
    id: (row as { id: string }).id,
    name: (row as { name: string }).name,
    incubatorMotherName: (row as { incubatorMotherName?: string | null }).incubatorMotherName ?? null,
    deliverySettings: (row as { deliverySettings?: unknown }).deliverySettings as {
      deliveryPricingMode?: "FIXED" | "DISTANCE_BASED";
      fixedDeliveryFee?: { toString(): string } | null;
      baseDeliveryFee?: { toString(): string } | null;
      pricePerKm?: { toString(): string } | null;
      deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      defaultDeliveryFee?: { toString(): string } | null;
    } | null,
    displayI18n: (row as { displayI18n?: import("@prisma/client").Prisma.JsonValue | null }).displayI18n,
  });
}
