import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

export type EnsureActiveBranchForCompanyOutcome =
  | { outcome: "already_had_active"; branchId: string }
  | { outcome: "reactivated"; branchId: string }
  | { outcome: "created"; branchId: string };

/** Default Arabic label for auto-created branches (PHASE 3/4 spec). */
export const DEFAULT_BRANCH_NAME_AR = "الفرع الرئيسي" as const;

export type EnsureActiveBranchForCompanyOptions = {
  /** When set (e.g. operational store scoped to admin branch), prefer reactivating this branch only */
  branchIdConstraint?: string | null;
  /** Override default Arabic name when creating a new branch */
  preferredBranchName?: string;
  /** Activity log attribution; may be null for system-style repair */
  actorUserId?: string | null;
};

/**
 * Guarantee ≥1 active `Branch` for the company — idempotent, no duplicate defaults.
 * Only creates/reactivates `Branch` rows; does not alter dispatch/pricing/RBAC/order logic.
 */
export async function ensureActiveBranchForCompany(
  db: Pick<Prisma.TransactionClient, "branch">,
  companyId: string,
  options?: EnsureActiveBranchForCompanyOptions,
): Promise<EnsureActiveBranchForCompanyOutcome> {
  const branchIdConstraint = options?.branchIdConstraint ?? null;
  const actorLog = options?.actorUserId ?? null;

  /** Scoped operational path: fix the requested branch row only */
  if (branchIdConstraint) {
    const targeted = await db.branch.findFirst({
      where: { id: branchIdConstraint, companyId },
      select: { id: true, isActive: true },
    });
    if (!targeted) {
      throw new AppError(
        422,
        "No active branch configured for this company.",
        "COMPANY_BRANCH_REQUIRED",
        {
          messageAr: "الفرع غير مفعّل لهذه الشركة. الرجاء التواصل مع الإدارة.",
          messageEn: "No active branch is configured for this company. Please contact your administrator.",
        },
      );
    }
    if (!targeted.isActive) {
      await db.branch.update({
        where: { id: targeted.id },
        data: { isActive: true },
      });
      await activityService.log(actorLog, "BRANCH_REACTIVATED_FOR_SCOPE", "branch", targeted.id, {
        companyId,
        reason: "ensureActiveBranchForCompany_branchIdConstraint",
      });
      return { outcome: "reactivated", branchId: targeted.id };
    }
    return { outcome: "already_had_active", branchId: targeted.id };
  }

  const firstActive = await db.branch.findFirst({
    where: { companyId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstActive) {
    return { outcome: "already_had_active", branchId: firstActive.id };
  }

  const oldestInactive = await db.branch.findFirst({
    where: { companyId, isActive: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (oldestInactive) {
    await db.branch.update({
      where: { id: oldestInactive.id },
      data: { isActive: true },
    });
    await activityService.log(actorLog, "BRANCH_REACTIVATED", "branch", oldestInactive.id, {
      companyId,
      reason: "ensureActiveBranchForCompany_companyWide",
    });
    return { outcome: "reactivated", branchId: oldestInactive.id };
  }

  const name = options?.preferredBranchName?.trim() || DEFAULT_BRANCH_NAME_AR;
  const row = await db.branch.create({
    data: {
      companyId,
      name,
      isActive: true,
    },
    select: { id: true },
  });
  await activityService.log(actorLog, "BRANCH_CREATED_DEFAULT", "branch", row.id, {
    companyId,
    name,
    reason: "ensureActiveBranchForCompany_companyWide",
  });
  return { outcome: "created", branchId: row.id };
}

/** @deprecated use ensureActiveBranchForCompany — kept for gradual import churn */
export const ensureCompanyHasActiveBranch = (
  db: Pick<Prisma.TransactionClient, "branch">,
  companyId: string,
) => ensureActiveBranchForCompany(db, companyId);
