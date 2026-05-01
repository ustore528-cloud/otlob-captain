import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { DEFAULT_BRANCH_NAME_AR, ensureActiveBranchForCompany } from "./company-branch-bootstrap.service.js";

/** Auto-created system store (pre–Phase S2) */
export const LEGACY_OPERATIONAL_STORE_NAME = "متجر التشغيل";
export const OPERATIONAL_STORE_NAME_PREFIX = "Operational Store - ";

function truncateStoreName(s: string, max = 200): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function isOperationalStoreName(name: string): boolean {
  return name === LEGACY_OPERATIONAL_STORE_NAME || name.startsWith(OPERATIONAL_STORE_NAME_PREFIX);
}

function operationalStoreDisplayName(companyName: string): string {
  return truncateStoreName(`${OPERATIONAL_STORE_NAME_PREFIX}${companyName}`.trim());
}

/**
 * Resolves a single hidden operational store for company-scoped order creation (no client storeId).
 * - Prefers an existing store whose name is legacy Arabic or "Operational Store - {companyName}".
 * - Otherwise creates one on the first active branch (or a branch that matches `branchIdFilter` when set).
 */
export async function resolveOrCreateOperationalStoreId(input: {
  companyId: string;
  /** When set (e.g. branch-scoped staff), only match/create within this branch. */
  branchIdFilter: string | null;
  ownerUserId: string;
}): Promise<string> {
  const { companyId, branchIdFilter, ownerUserId } = input;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  if (!company) {
    throw new AppError(500, "Company not found for operational store", "INTERNAL");
  }

  const existing = await prisma.store.findFirst({
    where: {
      isActive: true,
      companyId,
      OR: [
        { name: { startsWith: OPERATIONAL_STORE_NAME_PREFIX } },
        { name: LEGACY_OPERATIONAL_STORE_NAME },
      ],
      ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return existing.id;
  }

  let defaultBranchId: string;
  try {
    const ensured = await ensureActiveBranchForCompany(prisma, companyId, {
      branchIdConstraint: branchIdFilter,
      actorUserId: ownerUserId,
      preferredBranchName: DEFAULT_BRANCH_NAME_AR,
    });
    defaultBranchId = ensured.branchId;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      422,
      "No active branch configured for this company",
      "COMPANY_BRANCH_REQUIRED",
      {
        messageAr: "الفرع غير مفعّل لهذه الشركة. الرجاء التواصل مع الإدارة.",
        messageEn: "No active branch is configured for this company. Please contact your administrator.",
      },
    );
  }

  const name = operationalStoreDisplayName(company.name);
  const operationalStore = await prisma.store.create({
    data: {
      name,
      phone: "0000000000",
      area: "عام",
      address: "System operational store (not a public storefront)",
      isActive: true,
      company: { connect: { id: companyId } },
      branch: { connect: { id: defaultBranchId } },
      owner: { connect: { id: ownerUserId } },
    },
  });
  return operationalStore.id;
}
